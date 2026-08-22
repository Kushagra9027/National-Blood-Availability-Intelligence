from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.auth.routes import require_role
from app.database import get_connection


router = APIRouter(
    prefix="/provider",
    tags=["Provider"]
)


@router.get("/inventory")
def get_inventory(
    current_user=Depends(require_role("provider"))
):
    bank_id = current_user.get("bank_id")

    if not bank_id:
        raise HTTPException(
            status_code=400,
            detail="Provider account is not linked to a blood bank"
        )

    conn = get_connection()

    bank = conn.execute(
        """
        SELECT
            bank_id,
            name,
            lat,
            lng,
            address,
            contact_number,
            is_active
        FROM blood_banks
        WHERE bank_id = ?
        """,
        (bank_id,)
    ).fetchone()

    if not bank:
        conn.close()

        raise HTTPException(
            status_code=404,
            detail="Blood bank not found"
        )

    inventory = conn.execute(
        """
        SELECT
            inventory_id,
            blood_type,
            units,
            expiry_date,
            updated_at
        FROM blood_inventory
        WHERE bank_id = ?
        ORDER BY blood_type
        """,
        (bank_id,)
    ).fetchall()

    conn.close()

    return {
        "bank": dict(bank),
        "inventory": [dict(item) for item in inventory]
    }