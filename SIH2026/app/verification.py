from app.database import get_connection


def verify_hospital(hospital_id: str):
    conn = get_connection()

    hospital = conn.execute(
        """
        SELECT *
        FROM hospitals
        WHERE hospital_id = ?
        """,
        (hospital_id,)
    ).fetchone()

    conn.close()

    if hospital is None:
        return False, "hospital_not_found", None

    if not hospital["is_active"]:
        return False, "hospital_inactive", None

    return True, None, hospital


def verify_doctor(doctor_id: str, hospital_id: str):
    conn = get_connection()

    doctor = conn.execute(
        """
        SELECT *
        FROM doctors
        WHERE doctor_id = ?
        """,
        (doctor_id,)
    ).fetchone()

    conn.close()

    if doctor is None:
        return False, "doctor_not_found", None

    if doctor["hospital_id"] != hospital_id:
        return False, "doctor_hospital_mismatch", None

    if not doctor["is_authorized"]:
        return False, "doctor_not_authorized", None

    return True, None, doctor


def validate_clinical_request(
    prescription_id: str | None,
    clinical_note: str | None
):
    if prescription_id:
        if len(prescription_id.strip()) >= 3:
            return True, "prescription_valid"

    if clinical_note:
        if len(clinical_note.strip()) >= 10:
            return True, "clinical_note_valid"

    return False, "pending_clinical_verification"