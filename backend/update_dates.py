import random
from datetime import datetime, timedelta
from sqlalchemy import text

from app import create_app
from models import db, Transaction

def update_transaction_dates():
    # Get all transactions
    transactions = Transaction.query.all()

    if not transactions:
        print("No transactions found.")
        return

    print(f"Found {len(transactions)} transactions. Updating dates...")

    # Update each transaction with a random date in the last 7 days
    for transaction in transactions:
        days_ago = random.randint(0, 6)
        random_time = timedelta(
            hours=random.randint(9, 21),  # Business hours 9 AM to 9 PM
            minutes=random.randint(0, 59),
            seconds=random.randint(0, 59)
        )
        new_created_at = datetime.utcnow() - timedelta(days=days_ago) - random_time
        transaction.created_at = new_created_at

    db.session.commit()
    print(f"Successfully updated {len(transactions)} transactions with dates from the last 7 days!")

if __name__ == "__main__":
    app = create_app()
    with app.app_context():
        update_transaction_dates()