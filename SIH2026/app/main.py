from fastapi import FastAPI
from fastapi.responses import JSONResponse
from datetime import datetime, timezone
from itertools import count
from fastapi.responses import JSONResponse, FileResponse
from pathlib import Path
from fastapi.staticfiles import StaticFiles

from app.database import init_db, get_connection
from app.seed import seed_database
from app.schemas import BloodRequest
from app.verification import (
    verify_hospital,
    verify_doctor,
    validate_clinical_request
)
from app.urgency import classify_urgency
from app.priority_queue import priority_queue
from app.audit import log_event


app = FastAPI(
    title="RaktSetu Verification",
    description="Stage 1 - Request verification, urgency classification and prioritization",
    version="1.0.0"
)
# ============================================================
# PERSON 3 - DISPATCHER DASHBOARD
# ============================================================

BASE_DIR = Path(__file__).resolve().parent

app.mount(
    "/static",
    StaticFiles(directory=BASE_DIR / "static"),
    name="static"
)


@app.get("/dashboard", include_in_schema=False)
def dashboard():
    dashboard_path = BASE_DIR / "templates" / "dashboard.html"
    return FileResponse(dashboard_path)

from fastapi import Request
import traceback

@app.exception_handler(Exception)
def global_exception_handler(request: Request, exc: Exception):
    tb = traceback.format_exc()
    print("GLOBAL EXCEPTION TRIGGERED:")
    print(tb)
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc), "traceback": tb}
    )


request_counter = count(1001)


# ============================================================
# STARTUP
# ============================================================

@app.on_event("startup")
def startup():
    init_db()
    seed_database()


# ============================================================
# UTILITY FUNCTIONS
# ============================================================

def generate_request_id():
    try:
        conn = get_connection()
        rows = conn.execute("SELECT request_id FROM blood_requests").fetchall()
        conn.close()
        ids = []
        for row in rows:
            req_id = row["request_id"]
            if req_id and req_id.startswith("R") and req_id[1:].isdigit():
                ids.append(int(req_id[1:]))
        if ids:
            return f"R{max(ids) + 1}"
    except Exception:
        pass
    return "R1001"


def current_timestamp():
    return datetime.now(timezone.utc).isoformat()


# ============================================================
# ROOT ENDPOINT
# ============================================================

@app.get("/favicon.ico", include_in_schema=False)
def favicon():
    favicon_path = Path(__file__).parent / "static" / "favicon.ico"

    if favicon_path.exists():
        return FileResponse(favicon_path)

    return JSONResponse(
        status_code=404,
        content={"message": "favicon_not_found"}
    )


@app.get("/")
def root():
    return {
        "service": "RaktSetu Verification",
        "stage": 1,
        "status": "running"
    }


# ============================================================
# SUBMIT BLOOD REQUEST
# ============================================================

@app.post("/submit-request")
def submit_request(request: BloodRequest):

    request_id = generate_request_id()
    timestamp = current_timestamp()

    # 1. Start by storing request in database as 'received' (not verified yet)
    conn = get_connection()
    conn.execute(
        """
        INSERT INTO blood_requests
        (request_id, hospital_id, doctor_id, blood_type, units_needed,
         urgency, hospital_lat, hospital_lng, verified, status, prescription_id, clinical_note, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            request_id,
            request.hospital_id,
            request.doctor_id,
            request.blood_type,
            request.units_needed,
            request.urgency_input,
            request.hospital_lat,
            request.hospital_lng,
            0,
            "received",
            request.prescription_id,
            request.clinical_note,
            timestamp
        )
    )
    conn.commit()
    conn.close()

    # --------------------------------------------------
    # 1. REQUEST RECEIVED
    # --------------------------------------------------

    log_event(
        request_id,
        "request_received",
        "Blood request received"
    )

    # --------------------------------------------------
    # 2. HOSPITAL VERIFICATION
    # --------------------------------------------------

    hospital_valid, hospital_reason, hospital = verify_hospital(
        request.hospital_id
    )

    if not hospital_valid:

        log_event(
            request_id,
            "hospital_verified",
            f"rejected: {hospital_reason}"
        )

        conn = get_connection()
        conn.execute(
            "UPDATE blood_requests SET status = 'rejected', verified = 0 WHERE request_id = ?",
            (request_id,)
        )
        conn.commit()
        conn.close()

        return JSONResponse(
            status_code=403,
            content={
                "verified": False,
                "reason": hospital_reason,
                "request_id": request_id
            }
        )

    log_event(
        request_id,
        "hospital_verified",
        f"hospital verified: {hospital['name']}"
    )

    # --------------------------------------------------
    # 3. DOCTOR VERIFICATION
    # --------------------------------------------------

    doctor_valid, doctor_reason, doctor = verify_doctor(
        request.doctor_id,
        request.hospital_id
    )

    if not doctor_valid:

        log_event(
            request_id,
            "doctor_verified",
            f"rejected: {doctor_reason}"
        )

        conn = get_connection()
        conn.execute(
            "UPDATE blood_requests SET status = 'rejected', verified = 0 WHERE request_id = ?",
            (request_id,)
        )
        conn.commit()
        conn.close()

        return JSONResponse(
            status_code=403,
            content={
                "verified": False,
                "reason": doctor_reason,
                "request_id": request_id
            }
        )

    log_event(
        request_id,
        "doctor_verified",
        f"doctor verified: {doctor['name']}"
    )

    # --------------------------------------------------
    # 4. CLINICAL / PRESCRIPTION VALIDATION
    # --------------------------------------------------

    clinical_valid, clinical_reason = validate_clinical_request(
        request.prescription_id,
        request.clinical_note
    )

    if not clinical_valid:

        log_event(
            request_id,
            "prescription_checked",
            "pending clinical verification"
        )

        conn = get_connection()
        conn.execute(
            "UPDATE blood_requests SET status = 'pending_clinical_verification', verified = 0 WHERE request_id = ?",
            (request_id,)
        )
        conn.commit()
        conn.close()

        return JSONResponse(
            status_code=202,
            content={
                "verified": False,
                "reason": "pending_clinical_verification",
                "request_id": request_id
            }
        )

    log_event(
        request_id,
        "prescription_checked",
        clinical_reason
    )

    # --------------------------------------------------
    # 5. URGENCY CLASSIFICATION
    # --------------------------------------------------

    urgency, priority = classify_urgency(
        request.urgency_input
    )

    log_event(
        request_id,
        "urgency_assigned",
        f"urgency={urgency}, priority={priority}"
    )

    # --------------------------------------------------
    # 6. CREATE SHARED REQUEST CONTRACT
    # --------------------------------------------------

    verified_request = {
        "request_id": request_id,
        "hospital_id": request.hospital_id,
        "doctor_id": request.doctor_id,
        "blood_type": request.blood_type,
        "units_needed": request.units_needed,
        "urgency": urgency,

        # IMPORTANT:
        # Use coordinates from the verified hospital,
        # not blindly trust coordinates supplied by requester.
        "hospital_lat": hospital["lat"],
        "hospital_lng": hospital["lng"],

        "verified": True,
        "timestamp": timestamp
    }

    # Update database record to verified/queued status and save actual hospital coordinates
    conn = get_connection()
    conn.execute(
        """
        UPDATE blood_requests 
        SET verified = 1, status = 'queued', hospital_lat = ?, hospital_lng = ?, urgency = ?
        WHERE request_id = ?
        """,
        (
            verified_request["hospital_lat"],
            verified_request["hospital_lng"],
            verified_request["urgency"],
            request_id
        )
    )
    conn.commit()
    conn.close()

    # --------------------------------------------------
    # 7. ADD TO PRIORITY QUEUE
    # --------------------------------------------------

    priority_queue.push(
        verified_request,
        priority
    )

    log_event(
        request_id,
        "priority_queued",
        f"queued with priority={priority}"
    )

    return verified_request



# ============================================================
# QUEUE ENDPOINTS
# ============================================================

# ------------------------------------------------------------
# PEEK NEXT REQUEST
# ------------------------------------------------------------

@app.get("/queue/peek")
def peek_next_request():

    request = priority_queue.peek()

    if request is None:
        return {
            "message": "queue_empty"
        }

    return request


# ------------------------------------------------------------
# POP NEXT REQUEST
# ------------------------------------------------------------

@app.post("/queue/pop")
def pop_next_request():

    request = priority_queue.pop()

    if request is None:
        return JSONResponse(
            status_code=404,
            content={
                "message": "queue_empty"
            }
        )

    # Update database record status
    conn = get_connection()
    conn.execute(
        "UPDATE blood_requests SET status = 'sent_to_fulfillment' WHERE request_id = ?",
        (request["request_id"],)
    )
    conn.commit()
    conn.close()

    log_event(
        request["request_id"],
        "sent_to_fulfillment",
        "Request released to fulfillment engine"
    )

    return request


# ------------------------------------------------------------
# GET ENTIRE QUEUE
# ------------------------------------------------------------

@app.get("/queue")
def get_queue():

    return {
        "queue_size": priority_queue.size(),
        "requests": priority_queue.get_all()
    }


# ============================================================
# AUDIT & STATISTICS ENDPOINTS
# ============================================================

# ------------------------------------------------------------
# GET REQUEST AUDIT TRAIL
# ------------------------------------------------------------

@app.get("/requests/{request_id}/audit")
def get_request_audit(request_id: str):

    conn = get_connection()

    logs = conn.execute(
        """
        SELECT
            request_id,
            event_name,
            timestamp,
            details
        FROM audit_log
        WHERE request_id = ?
        ORDER BY id ASC
        """,
        (request_id,)
    ).fetchall()

    conn.close()

    return {
        "request_id": request_id,
        "events": [dict(log) for log in logs]
    }


# ------------------------------------------------------------
# GET QUEUE STATISTICS
# ------------------------------------------------------------

@app.get("/stats/queue")
def get_queue_stats():
    all_requests = priority_queue.get_all()
    stats = {
        "critical": 0,
        "urgent": 0,
        "routine": 0,
        "scheduled": 0
    }
    for r in all_requests:
        urg = r.get("urgency", "").lower()
        if urg in stats:
            stats[urg] += 1
    return stats


# ------------------------------------------------------------
# GET VERIFICATION STATISTICS
# ------------------------------------------------------------

@app.get("/stats/verification")
def get_verification_stats():
    conn = get_connection()
    
    total = conn.execute("SELECT COUNT(*) as count FROM blood_requests").fetchone()["count"]
    verified = conn.execute("SELECT COUNT(*) as count FROM blood_requests WHERE verified = 1").fetchone()["count"]
    rejected = conn.execute("SELECT COUNT(*) as count FROM blood_requests WHERE verified = 0 AND status = 'rejected'").fetchone()["count"]
    pending = conn.execute("SELECT COUNT(*) as count FROM blood_requests WHERE verified = 0 AND status = 'pending_clinical_verification'").fetchone()["count"]
    
    conn.close()
    
    return {
        "requests_received": total,
        "verified": verified,
        "rejected": rejected,
        "pending_clinical": pending
    }


# ------------------------------------------------------------
# GET REJECTION ANALYSIS
# ------------------------------------------------------------

@app.get("/stats/rejections")
def get_rejection_analysis():
    conn = get_connection()
    
    # We can query audit_log for event_name = 'hospital_verified' or 'doctor_verified' where the details contain 'rejected: '
    logs = conn.execute(
        """
        SELECT details 
        FROM audit_log 
        WHERE event_name IN ('hospital_verified', 'doctor_verified', 'prescription_checked')
          AND details LIKE 'rejected: %'
        """
    ).fetchall()
    
    conn.close()
    
    reasons = {
        "doctor_not_authorized": 0,
        "hospital_not_found": 0,
        "hospital_inactive": 0,
        "doctor_hospital_mismatch": 0
    }
    
    for row in logs:
        detail = row["details"]
        # extract the reason part, e.g., "rejected: hospital_not_found" -> "hospital_not_found"
        reason = detail.replace("rejected: ", "").strip()
        if reason in reasons:
            reasons[reason] += 1
            
    return reasons
