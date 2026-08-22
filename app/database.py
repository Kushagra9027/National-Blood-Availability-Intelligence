import sqlite3
from pathlib import Path


# --------------------------------------------------
# DATABASE PATH
# --------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent.parent

DATA_DIR = BASE_DIR / "data"

DB_PATH = DATA_DIR / "raktsetu.db"

DATA_DIR.mkdir(exist_ok=True)


# --------------------------------------------------
# DATABASE CONNECTION
# --------------------------------------------------

def get_connection():
    conn = sqlite3.connect(DB_PATH, timeout=10)

    # Allows us to access columns using column names
    # e.g. row["hospital_id"]
    conn.row_factory = sqlite3.Row

    # Enforce foreign key relationships in SQLite
    conn.execute("PRAGMA foreign_keys = ON")

    return conn


# --------------------------------------------------
# INITIALIZE DATABASE
# --------------------------------------------------

def init_db():

    conn = get_connection()

    cursor = conn.cursor()

    # --------------------------------------------------
    # HOSPITALS TABLE
    # --------------------------------------------------

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS hospitals (
            hospital_id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            lat REAL NOT NULL,
            lng REAL NOT NULL,
            is_active INTEGER NOT NULL DEFAULT 1
        )
    """)

    # --------------------------------------------------
    # DOCTORS TABLE
    # --------------------------------------------------

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS doctors (
            doctor_id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            hospital_id TEXT NOT NULL,
            is_authorized INTEGER NOT NULL DEFAULT 1,

            FOREIGN KEY (hospital_id)
                REFERENCES hospitals(hospital_id)
        )
    """)

    # --------------------------------------------------
    # BLOOD REQUESTS TABLE
    # --------------------------------------------------

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS blood_requests (
            request_id TEXT PRIMARY KEY,

            hospital_id TEXT NOT NULL,
            doctor_id TEXT NOT NULL,

            blood_type TEXT NOT NULL,
            units_needed INTEGER NOT NULL,

            urgency TEXT NOT NULL,

            hospital_lat REAL NOT NULL,
            hospital_lng REAL NOT NULL,

            verified INTEGER NOT NULL DEFAULT 0,

            status TEXT NOT NULL DEFAULT 'verified',

            prescription_id TEXT,
            clinical_note TEXT,

            created_at TEXT NOT NULL,

            CHECK (units_needed > 0),

            CHECK (
                urgency IN (
                    'critical',
                    'urgent',
                    'routine',
                    'scheduled'
                )
            )
        )
    """)

    # --------------------------------------------------
    # AUDIT LOG TABLE
    # --------------------------------------------------

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,

            request_id TEXT NOT NULL,

            event_name TEXT NOT NULL,

            timestamp TEXT NOT NULL,

            details TEXT
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            user_id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL,
            hospital_id TEXT,
            doctor_id TEXT,
            bank_id TEXT,
            is_active INTEGER NOT NULL DEFAULT 1,

            CHECK (
                role IN (
                    'requester',
                    'provider',
                    'dispatcher',
                    'patient'
                )
            ),

            FOREIGN KEY (hospital_id)
                REFERENCES hospitals(hospital_id),

            FOREIGN KEY (doctor_id)
                REFERENCES doctors(doctor_id)
        )
    """)
        # --------------------------------------------------
    # BLOOD BANKS TABLE
    # --------------------------------------------------

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS blood_banks (
            bank_id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            lat REAL NOT NULL,
            lng REAL NOT NULL,
            address TEXT,
            contact_number TEXT,
            is_active INTEGER NOT NULL DEFAULT 1
        )
    """)
        # --------------------------------------------------
    # BLOOD INVENTORY TABLE
    # --------------------------------------------------

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS blood_inventory (
            inventory_id INTEGER PRIMARY KEY AUTOINCREMENT,

            bank_id TEXT NOT NULL,
            blood_type TEXT NOT NULL,
            units INTEGER NOT NULL,
            expiry_date TEXT NOT NULL,

            updated_at TEXT NOT NULL,

            CHECK (units >= 0),

            FOREIGN KEY (bank_id)
                REFERENCES blood_banks(bank_id)
        )
    """)

    conn.commit()

    conn.close()