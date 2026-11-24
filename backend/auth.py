import hashlib
from fastapi import HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from backend.config import ADMIN_PORTAL_PASSWORD, ADMIN_TOKEN_SECRET

security = HTTPBearer(auto_error=False)

def get_admin_token() -> str:
    return hashlib.sha256(f"{ADMIN_PORTAL_PASSWORD}:{ADMIN_TOKEN_SECRET}".encode()).hexdigest()

def verify_admin_password(password: str) -> bool:
    return password == ADMIN_PORTAL_PASSWORD

def get_current_admin(credentials: HTTPAuthorizationCredentials = Security(security)):
    expected_token = get_admin_token()
    if not credentials or credentials.credentials != expected_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return True
