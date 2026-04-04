import random
import sys
import os
from datetime import datetime, timedelta

# Add the current directory to the path
sys.path.insert(0, os.path.dirname(__file__))

from app import create_app
from models import (
    db,
    Location,
    User,
    UserRole,
    ProductVariant,
    Customer,
    Transaction,
    TransactionItem,
)

random.seed(42)

def insert_sample_sales():
    # Get existing data
    locations = Location.query.all()
    users = User.query.filter(User.role == UserRole.sales_associate).all()
    variants = ProductVariant.query.all()
    customers = Customer.query.all()

    if not locations or not users or not variants:
        print("No existing data found. Please run seed_data.py first.")
        return

    # Create 50 additional transactions over the last 7 days
    transactions_created = 0

    for i in range(50):
        # Random date in last 7 days
        days_ago = random.randint(0, 6)
        created_at = datetime.utcnow() - timedelta(days=days_ago)

        # Random location (stores only, not warehouses)
        store_locations = [loc for loc in locations if 'Warehouse' not in loc.name]
        location = random.choice(store_locations)

        # Random cashier
        cashier = random.choice(users)

        # Random customer (sometimes None)
        customer = random.choice(customers + [None] * 3)

        # Random payment method
        payment_method = random.choice(['cash', 'card', 'upi'])

        # Random items (2-5 per transaction)
        num_items = random.randint(2, 5)
        selected_variants = random.sample(variants, num_items)

        # Create transaction
        invoice_num = f"VE-{location.id}-{i+100:04d}"
        transaction = Transaction(
            invoice_number=invoice_num,
            location_id=location.id,
            customer_id=customer.id if customer else None,
            cashier_id=cashier.id,
            payment_method=payment_method,
            subtotal=0.0,
            tax=0.0,
            total_amount=0.0,
            status='completed',
            created_at=created_at,
        )
        db.session.add(transaction)
        db.session.flush()

        subtotal = 0.0
        for variant in selected_variants:
            quantity = random.randint(1, 5)
            unit_price = variant.effective_price
            discount = random.choice([0, 0, 0, 0.05, 0.1, 0.15]) * unit_price  # 0-15% discount sometimes
            item_total = (unit_price - discount) * quantity
            subtotal += item_total

            tx_item = TransactionItem(
                transaction_id=transaction.id,
                variant_id=variant.id,
                quantity=quantity,
                unit_price=unit_price,
                discount=discount,
                total_price=item_total,
            )
            db.session.add(tx_item)

        # Update transaction totals
        tax_rate = 0.18  # 18% GST
        tax = subtotal * tax_rate
        total = subtotal + tax

        transaction.subtotal = subtotal
        transaction.tax = tax
        transaction.total_amount = total

        # Update customer loyalty if applicable
        if customer:
            points_earned = int(total / 100)  # 1 point per 100 rupees
            customer.loyalty_points += points_earned
            customer.total_spend += total
            transaction.customer_points = points_earned
            customer.update_loyalty_tier()

        transactions_created += 1

    db.session.commit()
    print(f"Successfully inserted {transactions_created} sample sales transactions!")

if __name__ == "__main__":
    app = create_app()
    with app.app_context():
        insert_sample_sales()