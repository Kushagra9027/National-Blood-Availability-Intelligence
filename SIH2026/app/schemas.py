from pydantic import BaseModel, Field
from typing import Optional, Literal


# ============================================================
# INCOMING BLOOD REQUEST
# ============================================================

class BloodRequest(BaseModel):
    hospital_id: str
    doctor_id: str

    blood_type: str
    units_needed: int = Field(gt=0, le=20)

    urgency_input: Literal[
        "critical",
        "urgent",
        "routine",
        "scheduled"
    ]

    prescription_id: Optional[str] = None
    clinical_note: Optional[str] = None

    hospital_lat: float
    hospital_lng: float

# ============================================================
# VERIFIED REQUEST
# ============================================================

class VerifiedRequest(BaseModel):
    request_id: str
    hospital_id: str
    doctor_id: str
    blood_type: str
    units_needed: int
    urgency: str
    hospital_lat: float
    hospital_lng: float
    verified: bool
    timestamp: str