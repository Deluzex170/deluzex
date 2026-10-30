from datetime import datetime
from typing import Optional


def generate_order_identifiers(order_id_str: str, created_at: Optional[datetime] = None) -> tuple[str, str]:
    """
    Generate clean, standardized e-commerce identifiers:
    - Order Reference: DLX-YYMM-XXXX (e.g. DLX-2610-8B9C)
    - Invoice Number:  INV-YY-XXXX   (e.g. INV-26-8B9C)

    Uses 2-digit year (YY), 2-digit month (MM), and 4-digit uppercase hex from ObjectId.
    """
    dt = created_at or datetime.utcnow()
    yymm = dt.strftime("%y%m")
    yy = dt.strftime("%y")
    raw = str(order_id_str)
    suffix = raw[-4:].upper() if len(raw) >= 4 else "0001"
    order_number = f"DLX-{yymm}-{suffix}"
    invoice_number = f"INV-{yy}-{suffix}"
    return order_number, invoice_number

