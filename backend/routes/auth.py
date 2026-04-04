from flask import Blueprint, jsonify, request
from flask_jwt_extended import create_access_token
from models import User

auth_bp = Blueprint('auth', __name__)


@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({'message': 'Username and password are required.'}), 400

    user = User.query.filter_by(username=username).first()
    if not user or not user.check_password(password):
        return jsonify({'message': 'Invalid username or password.'}), 401

    access_token = create_access_token(
        identity=username,
        additional_claims={
            'role': user.role.value,
            'location_id': user.location_id,
        },
    )
    return jsonify({
        'access_token': access_token,
        'user': {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'role': user.role.value,
            'location_id': user.location_id,
        }
    })


@auth_bp.route('/refresh', methods=['POST'])
def refresh_token():
    return jsonify({'message': 'Token refresh placeholder'})
