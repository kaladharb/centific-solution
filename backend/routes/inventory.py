from flask import Blueprint, jsonify, request
from models import Inventory, Location, StockTransfer

inventory_bp = Blueprint('inventory', __name__)


@inventory_bp.route('/', methods=['GET'])
def get_inventory():
    inventory_items = Inventory.query.all()
    return jsonify([item.to_dict() for item in inventory_items])


@inventory_bp.route('/low-stock-alerts', methods=['GET'])
def get_low_stock_alerts():
    low_stock_items = Inventory.query.filter(
        Inventory.quantity_on_hand <= Inventory.reorder_point
    ).all()
    return jsonify([item.to_dict() for item in low_stock_items])


@inventory_bp.route('/transfers', methods=['GET'])
def get_transfers():
    status_filter = request.args.get('status')
    query = StockTransfer.query
    if status_filter:
        query = query.filter(StockTransfer.status == status_filter)
    transfers = query.all()
    return jsonify([{
        'id': t.id,
        'from_location_id': t.from_location_id,
        'to_location_id': t.to_location_id,
        'variant_id': t.variant_id,
        'quantity': t.quantity,
        'status': t.status,
        'created_at': t.created_at.isoformat() if t.created_at else None
    } for t in transfers])


@inventory_bp.route('/locations', methods=['GET'])
def get_locations():
    locations = Location.query.all()
    return jsonify([location.to_dict() for location in locations])
