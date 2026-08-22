from datetime import datetime, timedelta, timezone
import os

from jose import JWTError, jwt
from passlib.context import CryptContext


SECRET_KEY = os.getenv(
    "RAKTSETU_SECRET_KEY",
    "change-this-secret-key-before-production"
)

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto"
)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)


def create_access_token(
    user_id: str,
    role: str,
    hospital_id: str | None = None,
    doctor_id: str | None = None,
    bank_id: str | None = None
) -> str:

    expire = datetime.now(timezone.utc) + timedelta(
        minutes=ACCESS_TOKEN_EXPIRE_MINUTES
    )

    payload = {
        "sub": user_id,
        "role": role,
        "hospital_id": hospital_id,
        "doctor_id": doctor_id,
        "bank_id": bank_id,
        "exp": expire
    }

    return jwt.encode(
        payload,
        SECRET_KEY,
        algorithm=ALGORITHM
    )


def decode_access_token(token: str):
    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

        user_id = payload.get("sub")
        role = payload.get("role")

        if not user_id or not role:
            return None

        return {
            "user_id": user_id,
            "role": role,
            "hospital_id": payload.get("hospital_id"),
            "doctor_id": payload.get("doctor_id"),
            "bank_id": payload.get("bank_id")
        }

    except JWTError:
        return None