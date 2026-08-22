from app.database import get_connection


HOSPITALS = [
    ("H01", "City Care Hospital", 28.6139, 77.2090, 1),
    ("H02", "Metro General Hospital", 28.6280, 77.2180, 1),
    ("H03", "Shanti Medical Centre", 28.5355, 77.3910, 1),
    ("H04", "Apollo Demo Hospital", 28.5672, 77.2100, 1),
    ("H05", "LifeLine Hospital", 28.4595, 77.0266, 1),
    ("H06", "National Trauma Centre", 28.5672, 77.2430, 1),
    ("H07", "Green Valley Hospital", 28.7041, 77.1025, 1),
    ("H08", "Hope Medical Institute", 28.6692, 77.4538, 1),
    ("H09", "Sunrise Hospital", 28.4089, 77.3178, 1),
    ("H10", "CarePlus Hospital", 28.6130, 77.3100, 1),
]


DOCTORS = [
    ("D01", "Dr. Arjun Sharma", "H01", 1),
    ("D02", "Dr. Priya Verma", "H01", 1),

    ("D03", "Dr. Rahul Singh", "H02", 1),
    ("D04", "Dr. Neha Kapoor", "H02", 1),

    ("D05", "Dr. Amit Gupta", "H03", 1),

    ("D06", "Dr. Riya Mehta", "H04", 1),
    ("D07", "Dr. Karan Malhotra", "H05", 1),

    ("D08", "Dr. Simran Kaur", "H06", 1),
    ("D09", "Dr. Aditya Jain", "H07", 1),

    ("D10", "Dr. Ananya Rao", "H08", 1),

    # Unauthorized doctor for testing
    ("D11", "Dr. Test Unauthorized", "H01", 0),

    # Doctor belongs to another hospital
    ("D12", "Dr. Wrong Hospital", "H03", 1),
]


def seed_database():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.executemany("""
        INSERT OR IGNORE INTO hospitals
        (hospital_id, name, lat, lng, is_active)
        VALUES (?, ?, ?, ?, ?)
    """, HOSPITALS)

    cursor.executemany("""
        INSERT OR IGNORE INTO doctors
        (doctor_id, name, hospital_id, is_authorized)
        VALUES (?, ?, ?, ?)
    """, DOCTORS)

    conn.commit()
    conn.close()


if __name__ == "__main__":
    from app.database import init_db

    init_db()
    seed_database()

    print("Database initialized and seeded.")