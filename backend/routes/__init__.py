from functools import wraps
from flask_jwt_extended import jwt_required, get_jwt

ROLE_HIERARCHY = [
    'sales_associate',
    'store_supervisor',
    'regional_manager',
    'hq_admin',
]


def expand_roles(roles):
    expanded = set()
    for role in roles:
        if role.endswith('+'):
            base_role = role[:-1]
            if base_role in ROLE_HIERARCHY:
                index = ROLE_HIERARCHY.index(base_role)
                expanded.update(ROLE_HIERARCHY[index:])
        else:
            expanded.add(role)
    return expanded


def role_required(roles):
    expanded = expand_roles(roles)

    def decorator(fn):
        @wraps(fn)
        @jwt_required()
        def wrapper(*args, **kwargs):
            claims = get_jwt()
            user_role = claims.get('role')
            if not user_role:
                return {'error': 'User role missing in access token'}, 403
            if user_role not in expanded:
                return {'error': 'Insufficient permissions'}, 403
            return fn(*args, **kwargs)

        return wrapper

    return decorator
