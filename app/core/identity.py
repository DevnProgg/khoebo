import re


def normalize_phone(value: str | None) -> str | None:
    if value is None:
        return None
    digits = re.sub(r"\D", "", value)
    return digits or None


def looks_like_email(value: str) -> bool:
    return "@" in value
