from datetime import datetime
from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity

from models import (
    db,
    Transaction,
    TransactionItem,
    ReturnRecord,
    ReturnItem,
    Inventory,
    InventoryAdjustment,
    Customer,
    log_audit,
)
from routes import role_required

returns_bp = Blueprint('returns', __name__)


def parse_date(value):
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


@returns_bp.route('/', methods=['POST'])
@role_required(['sales_associate+'])
def create_return():
    payload = request.get_json() or {}
    original_transaction_id = payload.get('original_transaction_id')
    reason = payload.get('reason')
    items = payload.get('items', [])

    if not original_transaction_id or not reason or not items:
        return {'error': 'original_transaction_id, reason, and items are required'}, 400

    transaction = Transaction.query.get(original_transaction_id)
    if not transaction or transaction.status != 'completed':
        return {'error': 'Original transaction not found or not eligible for returns'}, 400

    original_quantities = {item.variant_id: item.quantity for item in transaction.items}
    validation_errors = []
    total_refund = 0.0
    item_entries = []

    for index, item in enumerate(items, start=1):
        variant_id = item.get('variant_id')
        quantity = item.get('quantity', 0)
        condition = item.get('condition')
        if not variant_id or quantity <= 0 or condition not in ('resellable', 'damaged'):
            validation_errors.append({'item': index, 'error': 'Invalid return item payload'})
            continue
        purchased = original_quantities.get(variant_id, 0)
        if purchased <= 0:
            validation_errors.append({'item': index, 'error': 'Variant not found on original transaction'})
            continue
        if quantity > purchased:
            validation_errors.append({'item': index, 'error': 'Return quantity exceeds purchased quantity'})
            continue
        original_item = next((t for t in transaction.items if t.variant_id == variant_id), None)
        if not original_item:
            validation_errors.append({'item': index, 'error': 'Variant not found in original transaction'})
            continue
        total_refund += float(original_item.unit_price) * quantity
        item_entries.append({'variant_id': variant_id, 'quantity': quantity, 'condition': condition, 'unit_price': float(original_item.unit_price)})

    if validation_errors:
        return {'error': 'Validation failed', 'details': validation_errors}, 400

    try:
        return_record = ReturnRecord(
            original_transaction_id=transaction.id,
            total_refund_amount=round(total_refund, 2),
        )
        db.session.add(return_record)
        db.session.flush()

        for entry in item_entries:
            return_item = ReturnItem(
                return_id=return_record.id,
                variant_id=entry['variant_id'],
                quantity=entry['quantity'],
                condition=entry['condition'],
                unit_price=entry['unit_price'],
            )
            db.session.add(return_item)
            if entry['condition'] == 'resellable':
                inventory = Inventory.query.filter_by(location_id=transaction.location_id, variant_id=entry['variant_id']).first()
                if inventory:
                    inventory.quantity_on_hand += entry['quantity']
                else:
                    inventory = Inventory(
                        location_id=transaction.location_id,
                        variant_id=entry['variant_id'],
                        quantity_on_hand=entry['quantity'],
                        quantity_reserved=0,
                        reorder_point=0,
                    )
                    db.session.add(inventory)
            else:
                db.session.add(InventoryAdjustment(
                    variant_id=entry['variant_id'],
                    location_id=transaction.location_id,
                    delta=0,
                    reason='damaged',
                    notes='Damaged return recorded',
                ))

        returned_qty = sum(entry['quantity'] for entry in item_entries)
        total_purchased = sum(original_quantities.values())
        if returned_qty >= total_purchased:
            transaction.status = 'refunded'

        if transaction.customer:
            points_deduct = int(total_refund / 100)
            transaction.customer.loyalty_points = max(0, transaction.customer.loyalty_points - points_deduct)

        current_user_id = get_jwt_identity()
        log_audit(current_user_id, 'create_return', 'returns', {
            'original_transaction_id': original_transaction_id,
            'refund_amount': float(return_record.total_refund_amount),
        })
        db.session.commit()
    except Exception as err:
        db.session.rollback()
        return {'error': 'Failed to create return', 'details': str(err)}, 500

    return {'return': return_record.to_dict(), 'refund_amount': float(return_record.total_refund_amount)}, 201


@returns_bp.route('/', methods=['GET'])
@role_required(['store_supervisor+'])
def list_returns():
    query = ReturnRecord.query.join(Transaction)
    location_id = request.args.get('location_id', type=int)
    date_from = parse_date(request.args.get('date_from'))
    date_to = parse_date(request.args.get('date_to'))
    page = request.args.get('page', default=1, type=int)
    per_page = request.args.get('per_page', default=20, type=int)

    if location_id:
        query = query.filter(Transaction.location_id == location_id)
    if date_from:
        query = query.filter(ReturnRecord.created_at >= date_from)
    if date_to:
        query = query.filter(ReturnRecord.created_at <= date_to)

    page_data = query.order_by(ReturnRecord.created_at.desc()).paginate(page=page, per_page=per_page, error_out=False)
    results = []
    for record in page_data.items:
        results.append({
            **record.to_dict(),
            'original_invoice_number': record.transaction.invoice_number if record.transaction else None,
            'customer': record.transaction.customer.to_dict() if record.transaction and record.transaction.customer else None,
        })

    return {
        'returns': results,
        'total': page_data.total,
        'page': page_data.page,
        'pages': page_data.pages,
        'per_page': page_data.per_page,
    }
