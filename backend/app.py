import os
from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_sqlalchemy import SQLAlchemy

from config import Config
from models import db, Category, Location
from routes.auth import auth_bp
from routes.products import products_bp
from routes.inventory import inventory_bp
from routes.sales import sales_bp
from routes.returns import returns_bp
from routes.customers import customers_bp
from routes.reports import reports_bp
from routes.ai_service import ai_bp

jwt = JWTManager()


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    db.init_app(app)
    jwt.init_app(app)
    CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)

    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(products_bp, url_prefix='/api/products')
    app.register_blueprint(inventory_bp, url_prefix='/api/inventory')
    app.register_blueprint(sales_bp, url_prefix='/api/sales')
    app.register_blueprint(returns_bp, url_prefix='/api/returns')
    app.register_blueprint(customers_bp, url_prefix='/api/customers')
    app.register_blueprint(reports_bp, url_prefix='/api/reports')
    app.register_blueprint(ai_bp, url_prefix='/api/ai')

    @app.route('/api/locations', methods=['GET'])
    def get_locations_direct():
        locations = Location.query.all()
        return jsonify([location.to_dict() for location in locations])

    @app.route('/api/categories', methods=['GET'])
    def get_categories_direct():
        categories = Category.query.all()
        return jsonify([category.to_dict() for category in categories])

    @app.errorhandler(400)
    def bad_request(error):
        return jsonify({'error': 'Bad request', 'message': str(error)}), 400

    @app.errorhandler(401)
    def unauthorized(error):
        return jsonify({'error': 'Unauthorized'}), 401

    @app.errorhandler(403)
    def forbidden(error):
        return jsonify({'error': 'Forbidden'}), 403

    @app.errorhandler(404)
    def not_found(error):
        return jsonify({'error': 'Not found'}), 404

    @app.errorhandler(422)
    def unprocessable_entity(error):
        return jsonify({'error': 'Unprocessable entity', 'message': str(error)}), 422

    @app.errorhandler(500)
    def internal_error(error):
        app.logger.error(f"Internal error: {error}")
        return jsonify({'error': 'Internal server error'}), 500

    @app.route('/health', methods=['GET'])
    def health():
        return jsonify({'status': 'ok', 'service': 'VoltEdge API'})


    @app.before_request
    def create_tables():
        if not getattr(app, '_tables_created', False):
            db.create_all()
            app._tables_created = True
    def create_app():
        app = Flask(__name__)
        app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY')
        
    # other configs like SQLALCHEMY_DATABASE_URI
    return app

    


if __name__ == '__main__':
    app = create_app()
    debug_mode = os.getenv('FLASK_ENV') != 'production' and os.getenv('FLASK_DEBUG', '0') == '1'
    app.run(host='0.0.0.0', port=int(os.getenv('PORT', 5000)), debug=debug_mode)
