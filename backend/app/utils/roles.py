ROLE_HIERARCHY = {
    "manager": 4,
    "team_lead": 3,
    "qa": 2,
    "developer": 1
}

def has_permission(user_role: str, required_role: str) -> bool:
    """Check if user role >= required role"""
    return ROLE_HIERARCHY.get(user_role, 0) >= ROLE_HIERARCHY.get(required_role, 0)

def get_higher_roles(user_role: str) -> list:
    """Get all roles with same or higher authority"""
    user_level = ROLE_HIERARCHY.get(user_role, 0)
    return [role for role, level in ROLE_HIERARCHY.items() if level >= user_level]
