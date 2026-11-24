import hashlib
from fastapi import HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from backend.config import ADMIN_PORTAL_PASSWORD, ADMIN_TOKEN_SECRET

security = HTTPBearer(auto_error=False)

# In-memory cached active admin password (initialized from env, synchronized with DB)
ACTIVE_ADMIN_PASSWORD = ADMIN_PORTAL_PASSWORD

def set_active_admin_password(password: str):
    global ACTIVE_ADMIN_PASSWORD
    ACTIVE_ADMIN_PASSWORD = password

def get_active_admin_password() -> str:
    return ACTIVE_ADMIN_PASSWORD

def get_admin_token() -> str:
    return hashlib.sha256(f"{ACTIVE_ADMIN_PASSWORD}:{ADMIN_TOKEN_SECRET}".encode()).hexdigest()

def verify_admin_password(password: str) -> bool:
    return password == ACTIVE_ADMIN_PASSWORD

def get_current_admin(credentials: HTTPAuthorizationCredentials = Security(security)):
    expected_token = get_admin_token()
    if not credentials or credentials.credentials != expected_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return True
