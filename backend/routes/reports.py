from datetime import datetime, timedelta
from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt
from sqlalchemy import func, case
from models import (
    db,
    Transaction,
    TransactionItem,
    ProductVariant,
    Product,
    Category,
    Inventory,
    Location,
)
from routes import role_required

reports_bp = Blueprint('reports', __name__)


def parse_date(date_str, default=None):
    if not date_str or str(date_str).lower() in ('null', 'undefined'):
        return default
    try:
        return datetime.strptime(date_str[:10], '%Y-%m-%d')
    except Exception:
        return default


def parse_int(value, default=None):
    if value is None:
        return default
    try:
        return int(value)
    except Exception:
        return default


def get_role_location_filter(claims):
    role = claims.get('role')
    if role == 'hq_admin':
        return None
    location_id = claims.get('location_id')
    if role == 'regional_manager':
        if not location_id:
            return None
        user_location = Location.query.get(location_id)
        if not user_location:
            return None
        return [loc.id for loc in Location.query.filter_by(region=user_location.region).all()]
    if role in ('store_supervisor', 'sales_associate'):
        return [location_id] if location_id else None
    return []


@reports_bp.route('/sales-summary', methods=['GET'])
@role_required(['sales_associate+'])
def sales_summary():
    claims = get_jwt()
    location_id = parse_int(request.args.get('location_id'), None)
    date_from_str = request.args.get('date_from', '')
    date_to_str = request.args.get('date_to', '')

    print("date_from:", date_from_str)
    print("date_to:", date_to_str)
    print("location_id:", request.args.get('location_id'))

    default_date_from = datetime.utcnow() - timedelta(days=30)
    default_date_to = datetime.utcnow()
    date_from = parse_date(date_from_str, default_date_from)
    date_to = parse_date(date_to_str, default_date_to)

    if date_from > date_to:
        date_from = default_date_from
        date_to = default_date_to

    group_by = request.args.get('group_by', 'day')

    query = Transaction.query.filter(Transaction.status == 'completed')
    allowed_locations = get_role_location_filter(claims)
    if allowed_locations is not None:
        query = query.filter(Transaction.location_id.in_(allowed_locations))
    if location_id:
        query = query.filter(Transaction.location_id == location_id)
    if date_from:
        query = query.filter(Transaction.created_at >= date_from)
    if date_to:
        query = query.filter(Transaction.created_at <= date_to)

    totals = query.with_entities(
        func.coalesce(func.sum(Transaction.total_amount), 0),
        func.coalesce(func.count(Transaction.id), 0),
        func.coalesce(func.avg(Transaction.total_amount), 0),
    ).one()

    if group_by == 'week':
        period = func.date_trunc('week', Transaction.created_at)
        label = func.to_char(period, 'IYYY-IW')
    elif group_by == 'month':
        period = func.date_trunc('month', Transaction.created_at)
        label = func.to_char(period, 'YYYY-MM')
    else:
        period = func.date_trunc('day', Transaction.created_at)
        label = func.to_char(period, 'YYYY-MM-DD')

    chart_data = (
        query.with_entities(label.label('period'), func.coalesce(func.sum(Transaction.total_amount), 0).label('revenue'), func.count(Transaction.id).label('transactions'))
        .group_by(label)
        .order_by(label)
        .all()
    )

    return {
        'total_revenue': float(totals[0] or 0),
        'total_transactions': int(totals[1]),
        'avg_basket_size': float(totals[2] or 0),
        'total_discount_given': 0.0,
        'chart_data': [
            {'period': row.period, 'revenue': float(row.revenue or 0), 'transactions': int(row.transactions)}
            for row in chart_data
        ],
    }


@reports_bp.route('/top-products', methods=['GET'])
@role_required(['sales_associate+'])
def top_products():
    claims = get_jwt()
    location_id = parse_int(request.args.get('location_id'), None)
    date_from_str = request.args.get('date_from', '')
    date_to_str = request.args.get('date_to', '')

    print("date_from:", date_from_str)
    print("date_to:", date_to_str)
    print("location_id:", request.args.get('location_id'))

    default_date_from = datetime.utcnow() - timedelta(days=30)
    default_date_to = datetime.utcnow()
    date_from = parse_date(date_from_str, default_date_from)
    date_to = parse_date(date_to_str, default_date_to)

    if date_from > date_to:
        date_from = default_date_from
        date_to = default_date_to

    limit = request.args.get('limit', default=10, type=int)

    query = db.session.query(
        Product.id.label('product_id'),
        Product.name.label('product_name'),
        Product.brand.label('brand'),
        func.sum(TransactionItem.quantity).label('units_sold'),
        func.sum(TransactionItem.total_price).label('revenue'),
        func.sum(Product.cost_price * TransactionItem.quantity).label('cost'),
    ).join(ProductVariant, TransactionItem.variant_id == ProductVariant.id)
    query = query.join(Product, ProductVariant.product_id == Product.id)
    query = query.join(Transaction, TransactionItem.transaction_id == Transaction.id)
    query = query.filter(Transaction.status == 'completed')

    allowed_locations = get_role_location_filter(claims)
    if allowed_locations is not None:
        query = query.filter(Transaction.location_id.in_(allowed_locations))
    if location_id:
        query = query.filter(Transaction.location_id == location_id)
    if date_from:
        query = query.filter(Transaction.created_at >= date_from)
    if date_to:
        query = query.filter(Transaction.created_at <= date_to)

    query = query.group_by(Product.id).order_by(func.sum(TransactionItem.total_price).desc()).limit(limit)
    rows = query.all()

    return [
        {
            'product_id': row.product_id,
            'product_name': row.product_name,
            'brand': row.brand,
            'units_sold': int(row.units_sold or 0),
            'revenue': float(row.revenue or 0),
            'cost': float(row.cost or 0),
            'margin_amount': float((row.revenue or 0) - (row.cost or 0)),
            'margin_pct': float(((row.revenue or 0) - (row.cost or 0)) / row.revenue * 100) if row.revenue else 0,
        }
        for row in rows
    ]


@reports_bp.route('/inventory-health', methods=['GET'])
@role_required(['store_supervisor+'])
def inventory_health():
    claims = get_jwt()
    location_id = parse_int(request.args.get('location_id'), None)
    category_id = request.args.get('category_id', type=int)

    base = db.session.query(Inventory).join(ProductVariant).join(Product)
    allowed_locations = get_role_location_filter(claims)
    if allowed_locations is not None:
        base = base.filter(Inventory.location_id.in_(allowed_locations))
    if location_id:
        base = base.filter(Inventory.location_id == location_id)
    if category_id:
        base = base.filter(Product.category_id == category_id)

    total_skus = base.count()
    critical_count = base.filter(Inventory.quantity_on_hand <= Inventory.reorder_point).count()
    low_count = base.filter(
        (Inventory.quantity_on_hand > Inventory.reorder_point) &
        (Inventory.quantity_on_hand <= Inventory.reorder_point * 2)
    ).count()
    healthy_count = base.filter(Inventory.quantity_on_hand > Inventory.reorder_point * 2).count()

    total_inventory_value = db.session.query(
        func.coalesce(func.sum(Inventory.quantity_on_hand * Product.cost_price), 0)
    ).join(ProductVariant).join(Product)
    if allowed_locations is not None:
        total_inventory_value = total_inventory_value.filter(Inventory.location_id.in_(allowed_locations))
    if location_id:
        total_inventory_value = total_inventory_value.filter(Inventory.location_id == location_id)
    if category_id:
        total_inventory_value = total_inventory_value.filter(Product.category_id == category_id)
    total_value = total_inventory_value.scalar() or 0

    overstock_items = base.filter(Inventory.quantity_on_hand > Inventory.reorder_point * 3).limit(10).all()

    return {
        'total_skus': total_skus,
        'healthy_count': healthy_count,
        'low_count': low_count,
        'critical_count': critical_count,
        'total_inventory_value': float(total_value),
        'overstock_items': [item.to_dict() for item in overstock_items],
    }


@reports_bp.route('/store-performance', methods=['GET'])
@role_required(['regional_manager', 'hq_admin'])
def store_performance():
    region = request.args.get('region')
    date_from_str = request.args.get('date_from')
    date_to_str = request.args.get('date_to')

    # Default to last 30 days if no dates provided
    now = datetime.utcnow()
    default_date_from = now - timedelta(days=30)
    default_date_to = now

    date_from = parse_date(date_from_str, default_date_from)
    date_to = parse_date(date_to_str, default_date_to)

    # Ensure date_from is not after date_to
    if date_from > date_to:
        date_from = default_date_from
        date_to = default_date_to

    query = db.session.query(
        Location.id.label('store_id'),
        Location.name.label('store_name'),
        func.coalesce(func.sum(Transaction.total_amount), 0).label('revenue'),
        func.count(Transaction.id).label('transaction_count'),
        func.coalesce(func.avg(Transaction.total_amount), 0).label('avg_basket'),
        func.coalesce(func.sum(case([(Transaction.status == 'refunded', 1)], else_=0)), 0).label('refund_count'),
    ).join(Transaction, Transaction.location_id == Location.id)

    if region:
        query = query.filter(Location.region == region)
    if date_from:
        query = query.filter(Transaction.created_at >= date_from)
    if date_to:
        query = query.filter(Transaction.created_at <= date_to)

    query = query.filter(Transaction.status.in_(['completed', 'refunded']))
    query = query.group_by(Location.id).order_by(func.sum(Transaction.total_amount).desc())
    rows = query.all()

    result = []
    for row in rows:
        return_rate = float(row.refund_count or 0) / float(row.transaction_count or 1) * 100
        result.append({
            'store_id': row.store_id,
            'store_name': row.store_name,
            'revenue': float(row.revenue or 0),
            'transaction_count': int(row.transaction_count or 0),
            'avg_basket': float(row.avg_basket or 0),
            'return_rate_pct': round(return_rate, 2),
            'margin_pct': 0.0,
        })

    return result


@reports_bp.route('/margin-analysis', methods=['GET'])
@role_required(['store_supervisor+'])
def margin_analysis():
    location_id = parse_int(request.args.get('location_id'), None)
    category_id = request.args.get('category_id', type=int)
    date_from_str = request.args.get('date_from')
    date_to_str = request.args.get('date_to')

    # Default to last 30 days if no dates provided
    now = datetime.utcnow()
    default_date_from = now - timedelta(days=30)
    default_date_to = now

    date_from = parse_date(date_from_str, default_date_from)
    date_to = parse_date(date_to_str, default_date_to)

    # Ensure date_from is not after date_to
    if date_from > date_to:
        date_from = default_date_from
        date_to = default_date_to

    query = db.session.query(
        Category.id.label('category_id'),
        Category.name.label('category_name'),
        func.sum(TransactionItem.total_price).label('revenue'),
        func.sum(Product.cost_price * TransactionItem.quantity).label('cost'),
    ).join(ProductVariant, TransactionItem.variant_id == ProductVariant.id)
    query = query.join(Product, ProductVariant.product_id == Product.id)
    query = query.join(Category, Product.category_id == Category.id)
    query = query.join(Transaction, TransactionItem.transaction_id == Transaction.id)
    query = query.filter(Transaction.status == 'completed')

    if location_id:
        query = query.filter(Transaction.location_id == location_id)
    if category_id:
        query = query.filter(Category.id == category_id)
    if date_from:
        query = query.filter(Transaction.created_at >= date_from)
    if date_to:
        query = query.filter(Transaction.created_at <= date_to)

    query = query.group_by(Category.id)
    rows = query.all()

    overall_revenue = sum(float(row.revenue or 0) for row in rows)
    overall_cost = sum(float(row.cost or 0) for row in rows)
    overall_margin_pct = round(((overall_revenue - overall_cost) / overall_revenue) * 100, 2) if overall_revenue else 0.0

    by_category = []
    for row in rows:
        revenue = float(row.revenue or 0)
        cost = float(row.cost or 0)
        margin_pct = round(((revenue - cost) / revenue) * 100, 2) if revenue else 0.0
        by_category.append({
            'category_name': row.category_name,
            'revenue': revenue,
            'cost': cost,
            'margin_pct': margin_pct,
        })

    return {
        'overall_margin_pct': overall_margin_pct,
        'by_category': by_category,
        'chart_data': by_category,
    }
