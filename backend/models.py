import enum
import json
from datetime import datetime

import bcrypt
from flask_sqlalchemy import SQLAlchemy


db = SQLAlchemy()


class UserRole(enum.Enum):
    sales_associate = 'sales_associate'
    store_supervisor = 'store_supervisor'
    regional_manager = 'regional_manager'
    hq_admin = 'hq_admin'


class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.Enum(UserRole), default=UserRole.sales_associate, nullable=False)
    location_id = db.Column(db.Integer, db.ForeignKey('locations.id'), nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    loyalty_points = db.Column(db.Integer, default=0)
    total_spend = db.Column(db.Numeric(14, 2), default=0)
    loyalty_tier = db.Column(db.String(30), default='bronze')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    location = db.relationship('Location', back_populates='users')
    transactions = db.relationship('Transaction', back_populates='cashier', foreign_keys='Transaction.cashier_id')
    customers = db.relationship('Customer', back_populates='created_by', foreign_keys='Customer.created_by_id')

    def set_password(self, password):
        self.password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    def check_password(self, password):
        return bcrypt.checkpw(password.encode('utf-8'), self.password_hash.encode('utf-8'))

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'role': self.role.value,
            'location_id': self.location_id,
            'is_active': self.is_active,
            'loyalty_points': self.loyalty_points,
            'total_spend': float(self.total_spend or 0),
            'loyalty_tier': self.loyalty_tier,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }

    def update_loyalty_tier(self):
        spend = float(self.total_spend or 0)
        if spend >= 100000:
            self.loyalty_tier = 'platinum'
        elif spend >= 50000:
            self.loyalty_tier = 'gold'
        elif spend >= 10000:
            self.loyalty_tier = 'silver'
        else:
            self.loyalty_tier = 'bronze'


class Location(db.Model):
    __tablename__ = 'locations'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    region = db.Column(db.String(120), nullable=False)

    inventory = db.relationship('Inventory', back_populates='location')
    users = db.relationship('User', back_populates='location')
    transactions = db.relationship('Transaction', back_populates='location')

    def to_dict(self):
        return {'id': self.id, 'name': self.name, 'region': self.region}


class Category(db.Model):
    __tablename__ = 'categories'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    parent_id = db.Column(db.Integer, db.ForeignKey('categories.id'), nullable=True)

    parent = db.relationship('Category', remote_side=[id], backref='children')

    def to_dict(self):
        return {'id': self.id, 'name': self.name, 'parent_id': self.parent_id}


class Product(db.Model):
    __tablename__ = 'products'
    id = db.Column(db.Integer, primary_key=True)
    sku = db.Column(db.String(80), unique=True, nullable=False)
    name = db.Column(db.String(200), nullable=False)
    brand = db.Column(db.String(120), nullable=True)
    category_id = db.Column(db.Integer, db.ForeignKey('categories.id'), nullable=True)
    base_price = db.Column(db.Numeric(14, 2), nullable=False)
    cost_price = db.Column(db.Numeric(14, 2), nullable=False)
    description = db.Column(db.Text, nullable=True)
    is_active = db.Column(db.Boolean, default=True)

    category = db.relationship('Category', backref='products')
    variants = db.relationship('ProductVariant', back_populates='product')

    def to_dict(self):
        return {
            'id': self.id,
            'sku': self.sku,
            'name': self.name,
            'brand': self.brand,
            'category_id': self.category_id,
            'base_price': float(self.base_price or 0),
            'cost_price': float(self.cost_price or 0),
            'description': self.description,
            'is_active': self.is_active,
        }


class ProductVariant(db.Model):
    __tablename__ = 'product_variants'
    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    sku_variant = db.Column(db.String(120), unique=True, nullable=False)
    barcode = db.Column(db.String(120), nullable=True)
    attributes = db.Column(db.JSON, nullable=True)
    price_override = db.Column(db.Numeric(14, 2), nullable=True)

    product = db.relationship('Product', back_populates='variants')
    inventory = db.relationship('Inventory', back_populates='variant')
    transaction_items = db.relationship('TransactionItem', back_populates='variant')

    @property
    def effective_price(self):
        return float(self.price_override or self.product.base_price or 0)

    def to_dict(self):
        return {
            'id': self.id,
            'sku_variant': self.sku_variant,
            'barcode': self.barcode,
            'attributes': self.attributes or {},
            'price_override': float(self.price_override or 0),
            'effective_price': self.effective_price,
            'product_id': self.product_id,
        }


class Inventory(db.Model):
    __tablename__ = 'inventory'
    id = db.Column(db.Integer, primary_key=True)
    variant_id = db.Column(db.Integer, db.ForeignKey('product_variants.id'), nullable=False)
    location_id = db.Column(db.Integer, db.ForeignKey('locations.id'), nullable=False)
    quantity_on_hand = db.Column(db.Integer, default=0)
    quantity_reserved = db.Column(db.Integer, default=0)
    reorder_point = db.Column(db.Integer, default=0)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    variant = db.relationship('ProductVariant', back_populates='inventory')
    location = db.relationship('Location', back_populates='inventory')

    def to_dict(self):
        return {
            'inventory_id': self.id,
            'variant_id': self.variant_id,
            'sku_variant': self.variant.sku_variant,
            'product_name': self.variant.product.name,
            'brand': self.variant.product.brand,
            'attributes': self.variant.attributes or {},
            'location_id': self.location_id,
            'location_name': self.location.name,
            'region': self.location.region,
            'quantity_on_hand': self.quantity_on_hand,
            'quantity_reserved': self.quantity_reserved,
            'available_quantity': self.quantity_on_hand - self.quantity_reserved,
            'reorder_point': self.reorder_point,
            'last_updated': self.updated_at.isoformat() if self.updated_at else None,
        }


class Transaction(db.Model):
    __tablename__ = 'transactions'
    id = db.Column(db.Integer, primary_key=True)
    invoice_number = db.Column(db.String(120), unique=True, nullable=False)
    location_id = db.Column(db.Integer, db.ForeignKey('locations.id'), nullable=False)
    customer_id = db.Column(db.Integer, db.ForeignKey('customers.id'), nullable=True)
    cashier_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    payment_method = db.Column(db.String(30), nullable=False)
    subtotal = db.Column(db.Numeric(14, 2), nullable=False)
    tax = db.Column(db.Numeric(14, 2), nullable=False)
    total_amount = db.Column(db.Numeric(14, 2), nullable=False)
    status = db.Column(db.String(30), default='completed')
    customer_points = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    location = db.relationship('Location', back_populates='transactions')
    customer = db.relationship('Customer', back_populates='transactions')
    cashier = db.relationship('User', back_populates='transactions')
    items = db.relationship('TransactionItem', back_populates='transaction')

    def to_dict(self, include_items=False):
        payload = {
            'id': self.id,
            'invoice_number': self.invoice_number,
            'location_id': self.location_id,
            'location_name': self.location.name if self.location else None,
            'customer_id': self.customer_id,
            'customer_name': self.customer.name if self.customer else None,
            'cashier_id': self.cashier_id,
            'cashier_name': self.cashier.username if self.cashier else None,
            'payment_method': self.payment_method,
            'subtotal': float(self.subtotal or 0),
            'tax': float(self.tax or 0),
            'total_amount': float(self.total_amount or 0),
            'status': self.status,
            'customer_points': self.customer_points,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
        if include_items:
            payload['items'] = [item.to_dict() for item in self.items]
        return payload


class TransactionItem(db.Model):
    __tablename__ = 'transaction_items'
    id = db.Column(db.Integer, primary_key=True)
    transaction_id = db.Column(db.Integer, db.ForeignKey('transactions.id'), nullable=False)
    variant_id = db.Column(db.Integer, db.ForeignKey('product_variants.id'), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    unit_price = db.Column(db.Numeric(14, 2), nullable=False)
    discount = db.Column(db.Numeric(14, 2), nullable=False, default=0)
    total_price = db.Column(db.Numeric(14, 2), nullable=False)

    transaction = db.relationship('Transaction', back_populates='items')
    variant = db.relationship('ProductVariant', back_populates='transaction_items')

    def to_dict(self):
        return {
            'id': self.id,
            'variant_id': self.variant_id,
            'sku_variant': self.variant.sku_variant,
            'product_name': self.variant.product.name,
            'brand': self.variant.product.brand,
            'quantity': self.quantity,
            'unit_price': float(self.unit_price or 0),
            'discount': float(self.discount or 0),
            'total_price': float(self.total_price or 0),
            'attributes': self.variant.attributes or {},
        }


class StockReceipt(db.Model):
    __tablename__ = 'stock_receipts'
    id = db.Column(db.Integer, primary_key=True)
    location_id = db.Column(db.Integer, db.ForeignKey('locations.id'), nullable=False)
    variant_id = db.Column(db.Integer, db.ForeignKey('product_variants.id'), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    po_reference = db.Column(db.String(120), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    location = db.relationship('Location')
    variant = db.relationship('ProductVariant')


class InventoryAdjustment(db.Model):
    __tablename__ = 'inventory_adjustments'
    id = db.Column(db.Integer, primary_key=True)
    inventory_id = db.Column(db.Integer, db.ForeignKey('inventory.id'), nullable=True)
    variant_id = db.Column(db.Integer, db.ForeignKey('product_variants.id'), nullable=False)
    location_id = db.Column(db.Integer, db.ForeignKey('locations.id'), nullable=False)
    delta = db.Column(db.Integer, nullable=False)
    reason = db.Column(db.String(120), nullable=False)
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    inventory = db.relationship('Inventory')
    variant = db.relationship('ProductVariant')
    location = db.relationship('Location')


class StockTransfer(db.Model):
    __tablename__ = 'stock_transfers'
    id = db.Column(db.Integer, primary_key=True)
    from_location_id = db.Column(db.Integer, db.ForeignKey('locations.id'), nullable=False)
    to_location_id = db.Column(db.Integer, db.ForeignKey('locations.id'), nullable=False)
    variant_id = db.Column(db.Integer, db.ForeignKey('product_variants.id'), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    status = db.Column(db.String(30), default='requested')
    requested_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    approved_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    completed_at = db.Column(db.DateTime, nullable=True)
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    from_location = db.relationship('Location', foreign_keys=[from_location_id])
    to_location = db.relationship('Location', foreign_keys=[to_location_id])
    variant = db.relationship('ProductVariant')
    requester = db.relationship('User', foreign_keys=[requested_by])
    approver = db.relationship('User', foreign_keys=[approved_by])

    def to_dict(self):
        return {
            'id': self.id,
            'from_location_id': self.from_location_id,
            'from_location_name': self.from_location.name if self.from_location else None,
            'to_location_id': self.to_location_id,
            'to_location_name': self.to_location.name if self.to_location else None,
            'variant_id': self.variant_id,
            'sku_variant': self.variant.sku_variant if self.variant else None,
            'quantity': self.quantity,
            'status': self.status,
            'requested_by': self.requested_by,
            'approved_by': self.approved_by,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class ReturnRecord(db.Model):
    __tablename__ = 'returns'
    id = db.Column(db.Integer, primary_key=True)
    original_transaction_id = db.Column(db.Integer, db.ForeignKey('transactions.id'), nullable=False)
    total_refund_amount = db.Column(db.Numeric(14, 2), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    transaction = db.relationship('Transaction')
    items = db.relationship('ReturnItem', back_populates='return_record')

    def to_dict(self):
        return {
            'id': self.id,
            'original_transaction_id': self.original_transaction_id,
            'total_refund_amount': float(self.total_refund_amount or 0),
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'items': [item.to_dict() for item in self.items],
        }


class ReturnItem(db.Model):
    __tablename__ = 'return_items'
    id = db.Column(db.Integer, primary_key=True)
    return_id = db.Column(db.Integer, db.ForeignKey('returns.id'), nullable=False)
    variant_id = db.Column(db.Integer, db.ForeignKey('product_variants.id'), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    condition = db.Column(db.String(30), nullable=False)
    unit_price = db.Column(db.Numeric(14, 2), nullable=False)

    return_record = db.relationship('ReturnRecord', back_populates='items')
    variant = db.relationship('ProductVariant')

    def to_dict(self):
        return {
            'id': self.id,
            'variant_id': self.variant_id,
            'sku_variant': self.variant.sku_variant if self.variant else None,
            'quantity': self.quantity,
            'condition': self.condition,
            'unit_price': float(self.unit_price or 0),
        }


class Customer(db.Model):
    __tablename__ = 'customers'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=True)
    phone = db.Column(db.String(50), unique=True, nullable=False)
    loyalty_points = db.Column(db.Integer, default=0)
    loyalty_tier = db.Column(db.String(30), default='bronze')
    total_spend = db.Column(db.Numeric(14, 2), default=0)
    created_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    created_by = db.relationship('User', back_populates='customers')
    transactions = db.relationship('Transaction', back_populates='customer')

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'phone': self.phone,
            'loyalty_points': self.loyalty_points,
            'loyalty_tier': self.loyalty_tier,
            'total_spend': float(self.total_spend or 0),
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class AuditLog(db.Model):
    __tablename__ = 'audit_logs'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    action = db.Column(db.String(120), nullable=False)
    module = db.Column(db.String(120), nullable=False)
    details = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'action': self.action,
            'module': self.module,
            'details': json.loads(self.details) if self.details else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class AIQueryLog(db.Model):
    __tablename__ = 'ai_query_logs'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    query = db.Column(db.Text, nullable=False)
    response = db.Column(db.Text, nullable=False)
    model = db.Column(db.String(120), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'query': self.query,
            'response': self.response,
            'model': self.model,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


def log_audit(user_id, action, module, details=None):
    payload = None
    if details is not None:
        payload = json.dumps(details)
    audit = AuditLog(user_id=user_id, action=action, module=module, details=payload)
    db.session.add(audit)
    return audit
