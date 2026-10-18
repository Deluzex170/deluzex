from datetime import datetime, timedelta
from typing import Any, Union
from jose import jwt
import bcrypt

# In a real app, load this from config/env variables
SECRET_KEY = "super_secret_key_for_deluzex_keep_it_safe"
ALGORITHM = "HS256"
# 7 days token expiration for smooth admin and user sessions
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        if not plain_password or not hashed_password:
            return False
        pw_bytes = plain_password.encode('utf-8')[:72]
        hp_bytes = hashed_password.encode('utf-8') if isinstance(hashed_password, str) else hashed_password
        return bcrypt.checkpw(pw_bytes, hp_bytes)
    except Exception:
        return False

def get_password_hash(password: str) -> str:
    pw_bytes = (password or "").encode('utf-8')[:72]
    return bcrypt.hashpw(
        pw_bytes, 
        bcrypt.gensalt()
    ).decode('utf-8')

def create_access_token(subject: Union[str, Any], expires_delta: timedelta = None, is_admin: bool = False) -> str:
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode = {"exp": expire, "sub": str(subject), "is_admin": is_admin}
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

