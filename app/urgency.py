URGENCY_PRIORITY = {
    "critical": 1,
    "urgent": 2,
    "routine": 3,
    "scheduled": 4
}


def classify_urgency(urgency_input: str):
    urgency = urgency_input.lower().strip()

    if urgency not in URGENCY_PRIORITY:
        raise ValueError("invalid_urgency")

    return urgency, URGENCY_PRIORITY[urgency]