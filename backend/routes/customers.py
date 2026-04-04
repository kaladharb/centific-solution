from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity
from models import db, Customer, Transaction, log_audit
from routes import role_required

customers_bp = Blueprint('customers', __name__)


@customers_bp.route('/lookup', methods=['GET'])
@role_required(['sales_associate+'])
def lookup_customer():
    phone = request.args.get('phone')
    email = request.args.get('email')
    if not phone and not email:
        return {'error': 'phone or email is required'}, 400

    query = Customer.query
    if phone:
        query = query.filter(Customer.phone == phone)
    if email:
        query = query.filter(Customer.email == email)

    customer = query.first()
    if not customer:
        return {'error': 'Customer not found'}, 404

    recent_transactions = (
        Transaction.query.filter(Transaction.customer_id == customer.id)
        .order_by(Transaction.created_at.desc())
        .limit(5)
        .all()
    )

    return {
        'customer': customer.to_dict(),
        'recent_transactions': [txn.to_dict() for txn in recent_transactions],
    }


@customers_bp.route('/', methods=['GET'])
@role_required(['store_supervisor+'])
def list_customers():
    search = request.args.get('search')
    loyalty_tier = request.args.get('loyalty_tier')
    page = request.args.get('page', default=1, type=int)
    per_page = request.args.get('per_page', default=20, type=int)

    query = Customer.query
    if search:
        query = query.filter(
            (Customer.name.ilike(f'%{search}%')) | (Customer.phone.ilike(f'%{search}%'))
        )
    if loyalty_tier:
        query = query.filter(Customer.loyalty_tier == loyalty_tier)

    page_data = query.order_by(Customer.created_at.desc()).paginate(page=page, per_page=per_page, error_out=False)
    return {
        'customers': [customer.to_dict() for customer in page_data.items],
        'total': page_data.total,
        'page': page_data.page,
        'pages': page_data.pages,
        'per_page': page_data.per_page,
    }


@customers_bp.route('/', methods=['POST'])
@role_required(['sales_associate+'])
def create_customer():
    payload = request.get_json() or {}
    name = payload.get('name')
    phone = payload.get('phone')
    email = payload.get('email')

    if not name or not phone:
        return {'error': 'name and phone are required'}, 400

    if Customer.query.filter_by(phone=phone).first():
        return {'error': 'Phone already in use'}, 409

    current_user_id = get_jwt_identity()
    customer = Customer(
        name=name,
        phone=phone,
        email=email,
        loyalty_points=0,
        loyalty_tier='bronze',
        created_by_id=current_user_id,
    )
    db.session.add(customer)
    log_audit(current_user_id, 'create_customer', 'customers', {'phone': phone, 'name': name})
    db.session.commit()
    return customer.to_dict(), 201


@customers_bp.route('/<int:id>', methods=['PUT'])
@role_required(['sales_associate+'])
def update_customer(id):
    customer = Customer.query.get_or_404(id)
    payload = request.get_json() or {}
    name = payload.get('name')
    email = payload.get('email')

    if name:
        customer.name = name
    if email:
        customer.email = email

    db.session.commit()
    return customer.to_dict()
