import random
from datetime import datetime
from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt, get_jwt_identity
from sqlalchemy import func

from config import TAX_RATE
from models import (
    db,
    Transaction,
    TransactionItem,
    Inventory,
    Customer,
    ProductVariant,
    Location,
    User,
    log_audit,
)
from routes import role_required

sales_bp = Blueprint('sales', __name__)


def parse_date(value):
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def get_role_location_filter(claims):
    role = claims.get('role')
    if role == 'hq_admin':
        return None
    location_id = claims.get('location_id')
    if role == 'regional_manager':
        if not location_id:
            return []
        user_location = Location.query.get(location_id)
        if not user_location:
            return []
        allowed = [loc.id for loc in Location.query.filter_by(region=user_location.region).all()]
        return allowed
    if role in ('store_supervisor', 'sales_associate'):
        return [location_id] if location_id else []
    return []


@sales_bp.route('/transactions', methods=['POST'])
@role_required(['sales_associate+'])
def create_transaction():
    claims = get_jwt()
    payload = request.get_json() or {}
    location_id = payload.get('location_id')
    customer_id = payload.get('customer_id')
    payment_method = payload.get('payment_method')
    items = payload.get('items', [])

    if not location_id:
        return {'error': 'location_id is required'}, 400
    if payment_method not in ('cash', 'card', 'upi'):
        return {'error': 'Invalid payment_method'}, 400
    if not items or not isinstance(items, list):
        return {'error': 'items must be a non-empty list'}, 400

    location = Location.query.get(location_id)
    if not location:
        return {'error': 'Location not found'}, 404

    customer = None
    if customer_id:
        customer = Customer.query.get(customer_id)
        if not customer:
            return {'error': 'Customer not found'}, 404

    validation_errors = []
    item_records = []
    for index, item in enumerate(items, start=1):
        variant_id = item.get('variant_id')
        quantity = item.get('quantity', 0)
        discount = float(item.get('discount', 0) or 0)
        if not variant_id or quantity <= 0:
            validation_errors.append({'item': index, 'error': 'variant_id and positive quantity are required'})
            continue
        variant = ProductVariant.query.get(variant_id)
        if not variant:
            validation_errors.append({'item': index, 'error': 'Variant not found'})
            continue
        inventory = Inventory.query.filter_by(location_id=location_id, variant_id=variant_id).first()
        available = (inventory.quantity_on_hand - inventory.quantity_reserved) if inventory else 0
        if available < quantity:
            validation_errors.append({
                'item': index,
                'variant_id': variant_id,
                'available': available,
                'requested': quantity,
                'error': 'Insufficient stock',
            })
            continue
        item_records.append({'variant': variant, 'quantity': quantity, 'discount': discount, 'inventory': inventory})

    if validation_errors:
        return {'error': 'Validation failed', 'details': validation_errors}, 400

    subtotal = 0.0
    for entry in item_records:
        unit_price = entry['variant'].effective_price
        subtotal += (unit_price - entry['discount']) * entry['quantity']

    tax = round(subtotal * TAX_RATE, 2)
    total = round(subtotal + tax, 2)
    invoice_number = f"VE-{location_id}-{datetime.now().strftime('%Y%m%d')}-{random.randint(1000,9999)}"
    current_user_id = get_jwt_identity()

    try:
        transaction = Transaction(
            invoice_number=invoice_number,
            location_id=location_id,
            customer_id=customer_id,
            cashier_id=current_user_id,
            payment_method=payment_method,
            subtotal=subtotal,
            tax=tax,
            total_amount=total,
            status='completed',
        )
        db.session.add(transaction)
        db.session.flush()

        for entry in item_records:
            variant = entry['variant']
            quantity = entry['quantity']
            discount = entry['discount']
            unit_price = variant.effective_price
            item_total = round((unit_price - discount) * quantity, 2)
            transaction_item = TransactionItem(
                transaction_id=transaction.id,
                variant_id=variant.id,
                quantity=quantity,
                unit_price=unit_price,
                discount=discount,
                total_price=item_total,
            )
            db.session.add(transaction_item)
            if entry['inventory']:
                entry['inventory'].quantity_on_hand -= quantity
            else:
                inventory_record = Inventory(
                    variant_id=variant.id,
                    location_id=location_id,
                    quantity_on_hand=0,
                    quantity_reserved=0,
                    reorder_point=0,
                )
                db.session.add(inventory_record)
                inventory_record.quantity_on_hand -= quantity

        if customer:
            points_earned = int(total / 100)
            customer.loyalty_points += points_earned
            customer.total_spend += total
            customer.update_loyalty_tier()
            transaction.customer_points = points_earned

        log_audit(current_user_id, 'create_transaction', 'sales', {
            'invoice_number': invoice_number,
            'location_id': location_id,
            'customer_id': customer_id,
            'total': total,
        })
        db.session.commit()
    except Exception as err:
        db.session.rollback()
        return {'error': 'Transaction creation failed', 'details': str(err)}, 500

    return {'transaction': transaction.to_dict(include_items=True), 'items': [item.to_dict() for item in transaction.items]}, 201


@sales_bp.route('/transactions', methods=['GET'])
@role_required(['store_supervisor+'])
def list_transactions():
    claims = get_jwt()
    query = Transaction.query
    location_id = request.args.get('location_id', type=int)
    date_from = parse_date(request.args.get('date_from'))
    date_to = parse_date(request.args.get('date_to'))
    payment_method = request.args.get('payment_method')
    page = request.args.get('page', default=1, type=int)
    per_page = request.args.get('per_page', default=20, type=int)

    allowed_locations = get_role_location_filter(claims)
    if allowed_locations is not None:
        query = query.filter(Transaction.location_id.in_(allowed_locations))
    if location_id:
        query = query.filter(Transaction.location_id == location_id)
    if payment_method:
        query = query.filter(Transaction.payment_method == payment_method)
    if date_from:
        query = query.filter(Transaction.created_at >= date_from)
    if date_to:
        query = query.filter(Transaction.created_at <= date_to)

    page_data = query.order_by(Transaction.created_at.desc()).paginate(page=page, per_page=per_page, error_out=False)
    return {
        'transactions': [txn.to_dict() for txn in page_data.items],
        'total': page_data.total,
        'page': page_data.page,
        'pages': page_data.pages,
        'per_page': page_data.per_page,
    }


@sales_bp.route('/transactions/<int:id>', methods=['GET'])
@role_required(['store_supervisor+'])
def get_transaction(id):
    claims = get_jwt()
    transaction = Transaction.query.get_or_404(id)
    allowed_locations = get_role_location_filter(claims)
    if allowed_locations is not None and transaction.location_id not in allowed_locations:
        return {'error': 'Insufficient permissions'}, 403
    return {'transaction': transaction.to_dict(include_items=True)}


@sales_bp.route('/transactions/<int:id>/void', methods=['POST'])
@role_required(['store_supervisor+'])
def void_transaction(id):
    current_user_id = get_jwt_identity()
    transaction = Transaction.query.get_or_404(id)
    if transaction.status != 'completed':
        return {'error': 'Only completed transactions can be voided'}, 400

    try:
        transaction.status = 'voided'
        for item in transaction.items:
            inventory = Inventory.query.filter_by(location_id=transaction.location_id, variant_id=item.variant_id).first()
            if inventory:
                inventory.quantity_on_hand += item.quantity
            else:
                Inventory(
                    variant_id=item.variant_id,
                    location_id=transaction.location_id,
                    quantity_on_hand=item.quantity,
                    quantity_reserved=0,
                    reorder_point=0,
                )
        if transaction.customer_id and transaction.customer_points:
            customer = transaction.customer
            customer.loyalty_points = max(0, customer.loyalty_points - transaction.customer_points)
        log_audit(current_user_id, 'void_transaction', 'sales', {'transaction_id': id})
        db.session.commit()
    except Exception as err:
        db.session.rollback()
        return {'error': 'Unable to void transaction', 'details': str(err)}, 500

    return {'transaction': transaction.to_dict(include_items=True)}
