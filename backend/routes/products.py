from flask import Blueprint, jsonify
from models import Product

products_bp = Blueprint('products', __name__)


@products_bp.route('/', methods=['GET'])
def get_products():
    products = Product.query.all()
    return jsonify([product.to_dict() for product in products])
