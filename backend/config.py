import os
from dotenv import load_dotenv
load_dotenv()

class Config:
    SQLALCHEMY_DATABASE_URI = os.getenv(
        'DATABASE_URL',
        'postgresql://voltedge:password@localhost/voltedge_db'
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY')
    ANTHROPIC_API_KEY = os.getenv('ANTHROPIC_API_KEY', '')
    JWT_ACCESS_TOKEN_EXPIRES = False
    TAX_RATE = 0.18
    FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:5173')

TAX_RATE = Config.TAX_RATE
