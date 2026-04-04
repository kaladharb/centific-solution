import random

from app import create_app
from models import (
    db,
    Location,
    User,
    UserRole,
    Category,
    Product,
    ProductVariant,
    Inventory,
    Customer,
    Transaction,
    TransactionItem,
)

random.seed(42)

LOCATIONS = [
    ("VoltEdge Hyderabad Kukatpally", "Telangana"),
    ("VoltEdge Hyderabad Mehdipatnam", "Telangana"),
    ("VoltEdge Bangalore Koramangala", "Karnataka"),
    ("VoltEdge Chennai Anna Nagar", "Tamil Nadu"),
    ("VoltEdge Mumbai Andheri", "Maharashtra"),
    ("South Regional Warehouse Hyderabad", "Telangana"),
    ("Central Fulfillment Hub Pune", "Maharashtra"),
]

USERS = [
    ("admin", "admin@voltedge.com", UserRole.hq_admin, "password123"),
    ("south_manager", "manager@voltedge.com", UserRole.regional_manager, "password123"),
    ("kukat_supervisor", "supervisor@voltedge.com", UserRole.store_supervisor, "password123"),
    ("associate1", "associate@voltedge.com", UserRole.sales_associate, "password123"),
]

CATEGORIES = [
    "Smartphones",
    "Laptops",
    "Tablets",
    "Smart TVs",
    "Audio and Headphones",
    "Cameras",
    "Smart Home",
    "Wearables",
    "Gaming",
    "Accessories",
]

PRODUCTS = [
    {"name": "Samsung Galaxy S24", "brand": "Samsung", "category": "Smartphones", "price": 79999, "cost": 65000},
    {"name": "Apple iPhone 15", "brand": "Apple", "category": "Smartphones", "price": 79900, "cost": 66000},
    {"name": "OnePlus 12", "brand": "OnePlus", "category": "Smartphones", "price": 64999, "cost": 52000},
    {"name": "Dell XPS 13", "brand": "Dell", "category": "Laptops", "price": 129999, "cost": 105000},
    {"name": "MacBook Air M2", "brand": "Apple", "category": "Laptops", "price": 114900, "cost": 92000},
    {"name": "Samsung 55 inch TV", "brand": "Samsung", "category": "Smart TVs", "price": 59999, "cost": 45000},
    {"name": "Sony WH1000XM5", "brand": "Sony", "category": "Audio and Headphones", "price": 29990, "cost": 22000},
    {"name": "Apple Watch Series 9", "brand": "Apple", "category": "Wearables", "price": 41900, "cost": 33000},
    {"name": "boAt Airdopes 141", "brand": "boAt", "category": "Audio and Headphones", "price": 1299, "cost": 800},
    {"name": "Anker Powerbank 20000", "brand": "Anker", "category": "Accessories", "price": 2499, "cost": 1500},
]

CUSTOMERS = [
    ("Aarav Sharma", "aarav.sharma@example.com", "9848012345", "bronze", 1500),
    ("Priya Reddy", "priya.reddy@example.com", "9848112346", "bronze", 3800),
    ("Rohan Kapoor", "rohan.kapoor@example.com", "9848212347", "silver", 14500),
    ("Sneha Patel", "sneha.patel@example.com", "9848312348", "gold", 67500),
    ("Vikram Singh", "vikram.singh@example.com", "9848412349", "platinum", 125000),
]

PAYMENT_METHODS = ["cash", "card", "upi"]


def create_locations():
    locations = []
    for name, region in LOCATIONS:
        location = Location(name=name, region=region)
        db.session.add(location)
        locations.append(location)
    db.session.flush()
    return locations


def create_users():
    users = []
    for username, email, role, password in USERS:
        user = User(username=username, email=email, role=role)
        user.set_password(password)
        db.session.add(user)
        users.append(user)
    db.session.flush()
    return users


def create_categories():
    categories = {}
    for name in CATEGORIES:
        category = Category(name=name)
        db.session.add(category)
        categories[name] = category
    db.session.flush()
    return categories


def create_products(categories):
    variants = []
    for item in PRODUCTS:
        category = categories[item["category"]]
        prefix = item["name"][:3].upper()
        sku_num = str(random.randint(100, 999))
        sku = "VE-" + prefix + "-" + sku_num
        product = Product(
            sku=sku,
            name=item["name"],
            brand=item["brand"],
            category_id=category.id,
            base_price=item["price"],
            cost_price=item["cost"],
            description=item["name"] + " from " + item["brand"],
            is_active=True,
        )
        db.session.add(product)
        db.session.flush()
        for i in range(2):
            version = "Standard" if i == 0 else "Premium"
            variant_sku = sku + "-V" + str(i + 1)
            barcode = "BC" + str(random.randint(10000000, 99999999))
            variant = ProductVariant(
                product_id=product.id,
                sku_variant=variant_sku,
                barcode=barcode,
                attributes={"version": version},
                price_override=None,
            )
            db.session.add(variant)
            variants.append(variant)
    db.session.flush()
    return variants


def create_inventory(variants, store_locations):
    for store in store_locations:
        for variant in variants:
            quantity = random.randint(20, 80)
            inventory = Inventory(
                variant_id=variant.id,
                location_id=store.id,
                quantity_on_hand=quantity,
                quantity_reserved=0,
                reorder_point=10,
            )
            db.session.add(inventory)
    db.session.flush()
    # Set some low stock
    all_inventories = Inventory.query.filter(Inventory.location_id.in_([store.id for store in store_locations])).all()
    low_items = random.sample(all_inventories, min(3, len(all_inventories)))
    for item in low_items:
        item.quantity_on_hand = 5
    db.session.flush()


def create_customers():
    customers = []
    for name, email, phone, tier, spend in CUSTOMERS:
        customer = Customer(
            name=name,
            email=email,
            phone=phone,
            loyalty_tier=tier,
            loyalty_points=int(spend / 100),
            total_spend=spend,
        )
        db.session.add(customer)
        customers.append(customer)
    db.session.flush()
    return customers


def create_transactions(store_locations, customers, variants, users):
    store = store_locations[0]  # Store 1
    cashier = next((u for u in users if u.role == UserRole.sales_associate), users[0])
    transactions = []
    for i in range(20):
        customer = random.choice(customers + [None, None])
        selected_variants = random.sample(variants, random.randint(2, 3))
        subtotal = 0.0
        invoice_num = "VE-" + str(store.id) + "-" + str(i + 1).zfill(4)
        transaction = Transaction(
            invoice_number=invoice_num,
            location_id=store.id,
            customer_id=customer.id if customer else None,
            cashier_id=cashier.id,
            payment_method=random.choice(PAYMENT_METHODS),
            subtotal=0.0,
            tax=0.0,
            total_amount=0.0,
            status="completed",
        )
        db.session.add(transaction)
        db.session.flush()
        for variant in selected_variants:
            quantity = random.randint(1, 3)
            unit_price = variant.effective_price
            item_total = unit_price * quantity
            subtotal = subtotal + item_total
            tx_item = TransactionItem(
                transaction_id=transaction.id,
                variant_id=variant.id,
                quantity=quantity,
                unit_price=unit_price,
                discount=0.0,
                total_price=item_total,
            )
            db.session.add(tx_item)
        transaction.subtotal = subtotal
        transaction.tax = subtotal * 0.18
        transaction.total_amount = subtotal + transaction.tax
        if customer:
            points = int(transaction.total_amount / 100)
            customer.loyalty_points = customer.loyalty_points + points
            customer.total_spend = customer.total_spend + transaction.total_amount
            transaction.customer_points = points
        transactions.append(transaction)
    db.session.flush()
    return transactions


def seed_all():
    locations = create_locations()
    store_locations = locations[:5]
    users = create_users()
    categories = create_categories()
    variants = create_products(categories)
    create_inventory(variants, store_locations)
    customers = create_customers()
    create_transactions(store_locations, customers, variants, users)
    db.session.commit()


if __name__ == "__main__":
    app = create_app()
    with app.app_context():
        db.drop_all()
        db.create_all()
        seed_all()
        print("Database seeded successfully!")
