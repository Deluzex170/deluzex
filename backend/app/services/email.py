import logging
import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Dict, Any
from app.core.config import settings

logger = logging.getLogger("deluzex.email")

def _send_smtp_attempt(msg: MIMEMultipart, to_email: str) -> Dict[str, Any]:
    host = settings.SMTP_HOST.strip() or "smtpout.secureserver.net"
    port = int(settings.SMTP_PORT or 465)
    user = settings.SMTP_USER.strip()
    password = settings.SMTP_PASSWORD
    if not user or not password:
        return {"success": False, "error": "SMTP_USER and SMTP_PASSWORD must be configured on the server."}

    server = None
    stage = "connection"
    try:
        context = ssl.create_default_context()
        if port == 465:
            server = smtplib.SMTP_SSL(host, port, timeout=12, context=context)
            stage = "greeting"
            server.ehlo()
        else:
            server = smtplib.SMTP(host, port, timeout=12)
            stage = "greeting"
            server.ehlo()
            stage = "STARTTLS"
            server.starttls(context=context)
            server.ehlo()
        stage = "authentication"
        server.login(user, password)
        stage = "message delivery"
        refused = server.sendmail(user, [to_email], msg.as_string())
        if refused:
            raise smtplib.SMTPRecipientsRefused(refused)
        return {"success": True}
    except Exception as exc:
        logger.warning("SMTP failure host=%s port=%s stage=%s type=%s", host, port, stage, type(exc).__name__)
        if isinstance(exc, smtplib.SMTPAuthenticationError):
            error = "SMTP authentication failed. Check the mailbox credentials and provider SMTP access."
        elif isinstance(exc, smtplib.SMTPServerDisconnected):
            error = f"SMTP connection closed during {stage}. Check SMTP_HOST, SMTP_PORT and provider access."
        else:
            error = f"SMTP failed during {stage} ({type(exc).__name__}). Check the server email configuration."
        return {"success": False, "error": error, "retryable": isinstance(exc, (smtplib.SMTPServerDisconnected, TimeoutError)) and stage in ("connection", "greeting", "STARTTLS", "authentication")}
    finally:
        if server is not None:
            # A disconnect during QUIT must not report an already accepted email
            # as failed and prompt the user to request another OTP.
            try:
                server.quit()
            except Exception:
                try:
                    server.close()
                except OSError:
                    pass


def build_otp_email_html(otp: str, user_name: str = "") -> str:
    greeting_name = user_name.strip() if user_name else "Valued Client"
    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Deluzex Verification Code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b0b0d; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f5f5f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0b0b0d; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 520px; background: #141418; border: 1px solid rgba(212, 175, 55, 0.28); border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.65);">
          <!-- Header -->
          <tr>
            <td style="padding: 36px 36px 20px 36px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.06); background: #0e0e12;">
              <h1 style="margin: 0; font-size: 26px; font-weight: 700; letter-spacing: 0.18em; color: #d4af37; text-transform: uppercase;">
                DELUZEX
              </h1>
              <p style="margin: 6px 0 0 0; font-size: 11px; letter-spacing: 0.25em; color: rgba(255,255,255,0.45); text-transform: uppercase;">
                Luxe Lighting &amp; Living
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 36px;">
              <h2 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 600; color: #ffffff;">
                Verify Your Email Address
              </h2>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #a1a1aa;">
                Hello <strong style="color: #f4f4f5;">{greeting_name}</strong>, thank you for choosing Deluzex. Please use the 6-digit security code below to complete your registration and activate your account.
              </p>

              <!-- OTP Box -->
              <div style="background: rgba(212, 175, 55, 0.08); border: 1.5px dashed rgba(212, 175, 55, 0.45); border-radius: 12px; padding: 22px; text-align: center; margin: 26px 0;">
                <span style="display: block; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.2em; color: #d4af37; margin-bottom: 8px;">
                  Your Verification Code
                </span>
                <span style="font-family: 'Courier New', Courier, monospace; font-size: 38px; font-weight: 700; letter-spacing: 0.28em; color: #ffffff; text-shadow: 0 2px 10px rgba(212,175,55,0.35);">
                  {otp}
                </span>
              </div>

              <p style="margin: 0 0 14px 0; font-size: 13px; line-height: 1.6; color: #71717a;">
                • This verification code is valid for <strong>10 minutes</strong>.<br>
                • Do not share this code with anyone. Deluzex staff will never ask for your code.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 36px 30px 36px; text-align: center; border-top: 1px solid rgba(255,255,255,0.06); background: rgba(0,0,0,0.25);">
              <p style="margin: 0; font-size: 11px; color: #52525b; line-height: 1.5;">
                Need assistance? Contact our concierge at <a href="mailto:support@deluzexlighting.com" style="color: #d4af37; text-decoration: none;">support@deluzexlighting.com</a><br>
                &copy; Deluzex Luxury Lighting. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""

def _send_smtp_message(msg: MIMEMultipart, to_email: str) -> Dict[str, Any]:
    result = _send_smtp_attempt(msg, to_email)
    # Retry only before message delivery; retrying after DATA can send
    # duplicate codes when a server accepted the first message but lost its reply.
    if not result.get("success") and result.get("retryable"):
        result = _send_smtp_attempt(msg, to_email)
    return result


def _send_template_email(event: str, to_email: str, otp: str, user_name: str):
    from app.services.email_templates import render_email
    content = render_email(event, otp, user_name)
    msg = MIMEMultipart("alternative")
    msg["Subject"] = content["subject"]
    msg["From"] = settings.SMTP_FROM_EMAIL
    msg["To"] = to_email.strip().lower()
    msg.attach(MIMEText(content["text_body"], "plain", "utf-8"))
    msg.attach(MIMEText(content["html_body"], "html", "utf-8"))
    return _send_smtp_message(msg, to_email.strip().lower())


def send_verification_email(to_email: str, otp: str, user_name: str = "") -> Dict[str, Any]:
    return _send_template_email("verification", to_email, otp, user_name)


def build_password_reset_email_html(otp: str, user_name: str = "") -> str:
    greeting_name = user_name.strip() if user_name else "Valued Client"
    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Deluzex Password</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b0b0d; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f5f5f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0b0b0d; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 520px; background: #141418; border: 1px solid rgba(212, 175, 55, 0.28); border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.65);">
          <!-- Header -->
          <tr>
            <td style="padding: 36px 36px 20px 36px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.06); background: #0e0e12;">
              <h1 style="margin: 0; font-size: 26px; font-weight: 700; letter-spacing: 0.18em; color: #d4af37; text-transform: uppercase;">
                DELUZEX
              </h1>
              <p style="margin: 6px 0 0 0; font-size: 11px; letter-spacing: 0.25em; color: rgba(255,255,255,0.45); text-transform: uppercase;">
                Luxe Lighting &amp; Living
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 36px;">
              <h2 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 600; color: #ffffff;">
                Password Reset Request
              </h2>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #a1a1aa;">
                Hello <strong style="color: #f4f4f5;">{greeting_name}</strong>, we received a request to reset your Deluzex account password. Please enter the 6-digit verification code below to set your new password.
              </p>

              <!-- OTP Box -->
              <div style="background: rgba(212, 175, 55, 0.08); border: 1.5px dashed rgba(212, 175, 55, 0.45); border-radius: 12px; padding: 22px; text-align: center; margin: 26px 0;">
                <span style="display: block; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.2em; color: #d4af37; margin-bottom: 8px;">
                  Password Reset Code
                </span>
                <span style="font-family: 'Courier New', Courier, monospace; font-size: 38px; font-weight: 700; letter-spacing: 0.28em; color: #ffffff; text-shadow: 0 2px 10px rgba(212,175,55,0.35);">
                  {otp}
                </span>
              </div>

              <p style="margin: 0 0 14px 0; font-size: 13px; line-height: 1.6; color: #71717a;">
                • This reset code is valid for <strong>10 minutes</strong>.<br>
                • If you did not request this password reset, please ignore this email or contact support immediately.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 36px 30px 36px; text-align: center; border-top: 1px solid rgba(255,255,255,0.06); background: rgba(0,0,0,0.25);">
              <p style="margin: 0; font-size: 11px; color: #52525b; line-height: 1.5;">
                Need assistance? Contact our concierge at <a href="mailto:support@deluzexlighting.com" style="color: #d4af37; text-decoration: none;">support@deluzexlighting.com</a><br>
                &copy; Deluzex Luxury Lighting. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""

def send_password_reset_email(to_email: str, otp: str, user_name: str = "") -> Dict[str, Any]:
    return _send_template_email("password_reset", to_email, otp, user_name)


def build_order_confirmation_email_html(order: Dict[str, Any]) -> str:
    order_id = str(order.get("_id") or order.get("id") or "")
    short_id = order_id[:8].upper() if order_id else "DELUXE"
    
    addr = order.get("shipping_address") or {}
    first_name = addr.get("first_name", "")
    last_name = addr.get("last_name", "")
    customer_name = f"{first_name} {last_name}".strip() or "Valued Client"
    
    street = addr.get("street", "")
    city = addr.get("city", "")
    state = addr.get("state", "")
    pin_code = addr.get("pin_code", "")
    phone = order.get("phone") or addr.get("phone", "")
    
    subtotal = float(order.get("subtotal") or 0.0)
    gst = float(order.get("gst") or 0.0)
    delivery = float(order.get("delivery") or 0.0)
    total = float(order.get("total") or (subtotal + gst + delivery))
    
    pay_method = str(order.get("payment_method") or "Online").upper()
    delivery_label = "Complimentary White-Glove" if delivery == 0.0 else f"₹{delivery:,.2f}"

    items = order.get("items") or []
    item_rows = []
    for item in items:
        title = item.get("title") or item.get("name") or "Deluzex Bespoke Luminaire"
        qty = int(item.get("quantity") or 1)
        price = float(item.get("price") or 0.0)
        item_total = price * qty
        img = item.get("image") or ""
        
        img_tag = f'<img src="{img}" alt="{title}" style="width: 52px; height: 52px; object-fit: cover; border-radius: 8px; border: 1px solid rgba(212,175,55,0.3); vertical-align: middle; margin-right: 14px;" />' if img else ''
        
        item_rows.append(f"""
          <tr style="border-bottom: 1px solid rgba(255,255,255,0.06);">
            <td style="padding: 16px 12px; vertical-align: middle;">
              <table role="presentation" cellspacing="0" cellpadding="0">
                <tr>
                  {f'<td style="vertical-align: middle;">{img_tag}</td>' if img_tag else ''}
                  <td style="vertical-align: middle;">
                    <strong style="color: #ffffff; font-size: 14px; display: block; line-height: 1.4;">{title}</strong>
                    <span style="color: #a1a1aa; font-size: 12px;">Qty: {qty} &times; &#8377;{price:,.2f}</span>
                  </td>
                </tr>
              </table>
            </td>
            <td align="right" style="padding: 16px 12px; vertical-align: middle; color: #d4af37; font-weight: 600; font-size: 15px; white-space: nowrap;">
              &#8377;{item_total:,.2f}
            </td>
          </tr>
        """)
        
    items_html = "".join(item_rows) if item_rows else '<tr><td colspan="2" style="padding: 16px; text-align: center; color: #a1a1aa;">No items listed</td></tr>'

    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Confirmation #{short_id} - Deluzex</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b0b0d; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f5f5f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0b0b0d; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 620px; background: #141418; border: 1px solid rgba(212, 175, 55, 0.28); border-radius: 16px; overflow: hidden; box-shadow: 0 24px 48px rgba(0,0,0,0.75);">
          <!-- Header -->
          <tr>
            <td style="padding: 38px 36px 24px 36px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.06); background: #0e0e12;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; letter-spacing: 0.2em; color: #d4af37; text-transform: uppercase;">
                DELUZEX
              </h1>
              <p style="margin: 6px 0 0 0; font-size: 11px; letter-spacing: 0.28em; color: rgba(255,255,255,0.45); text-transform: uppercase;">
                Luxe Lighting &amp; Living
              </p>
            </td>
          </tr>

          <!-- Confirmation Hero -->
          <tr>
            <td style="padding: 32px 36px 16px 36px; text-align: center; background: radial-gradient(circle at center, rgba(212,175,55,0.08) 0%, transparent 70%);">
              <div style="display: inline-block; padding: 6px 16px; background: rgba(34, 197, 94, 0.12); border: 1px solid rgba(34, 197, 94, 0.35); border-radius: 20px; font-size: 11px; font-weight: 600; color: #4ade80; text-transform: uppercase; letter-spacing: 0.15em; margin-bottom: 14px;">
                Order Confirmed
              </div>
              <h2 style="margin: 0 0 10px 0; font-size: 22px; font-weight: 600; color: #ffffff;">
                Thank You for Your Patronage
              </h2>
              <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #a1a1aa;">
                Hello <strong style="color: #f4f4f5;">{customer_name}</strong>, we are delighted to confirm that your order <strong style="color: #d4af37;">#{short_id}</strong> has been received and is being prepared with utmost precision.
              </p>
            </td>
          </tr>

          <!-- Order Items Table -->
          <tr>
            <td style="padding: 20px 36px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse;">
                <thead>
                  <tr style="border-bottom: 1px solid rgba(212,175,55,0.25);">
                    <th align="left" style="padding: 10px 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; color: #d4af37;">Item Details</th>
                    <th align="right" style="padding: 10px 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; color: #d4af37;">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {items_html}
                </tbody>
              </table>
            </td>
          </tr>

          <!-- Financial Breakdown -->
          <tr>
            <td style="padding: 0 36px 24px 36px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 18px;">
                <tr>
                  <td style="padding: 6px 12px; font-size: 13px; color: #a1a1aa;">Subtotal</td>
                  <td align="right" style="padding: 6px 12px; font-size: 13px; color: #ffffff;">&#8377;{subtotal:,.2f}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 12px; font-size: 13px; color: #a1a1aa;">GST (18% Included)</td>
                  <td align="right" style="padding: 6px 12px; font-size: 13px; color: #ffffff;">&#8377;{gst:,.2f}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 12px; font-size: 13px; color: #a1a1aa;">Delivery</td>
                  <td align="right" style="padding: 6px 12px; font-size: 13px; color: #4ade80;">{delivery_label}</td>
                </tr>
                <tr style="border-top: 1px solid rgba(212,175,55,0.3);">
                  <td style="padding: 14px 12px 6px 12px; font-size: 15px; font-weight: 700; color: #ffffff; text-transform: uppercase; letter-spacing: 0.08em;">Total Paid ({pay_method})</td>
                  <td align="right" style="padding: 14px 12px 6px 12px; font-size: 20px; font-weight: 700; color: #d4af37;">&#8377;{total:,.2f}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Shipping Details & Support Box -->
          <tr>
            <td style="padding: 0 36px 32px 36px;">
              <div style="background: rgba(212, 175, 55, 0.05); border: 1px solid rgba(212, 175, 55, 0.2); border-radius: 12px; padding: 20px;">
                <h3 style="margin: 0 0 10px 0; font-size: 13px; text-transform: uppercase; letter-spacing: 0.15em; color: #d4af37;">
                  Delivery Address
                </h3>
                <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #d4d4d8;">
                  <strong>{customer_name}</strong><br>
                  {street}<br>
                  {city}, {state} - {pin_code}<br>
                  {f'Phone: {phone}' if phone else ''}
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 36px 32px 36px; text-align: center; border-top: 1px solid rgba(255,255,255,0.06); background: rgba(0,0,0,0.35);">
              <p style="margin: 0 0 10px 0; font-size: 12px; color: #a1a1aa; line-height: 1.5;">
                Need assistance with your bespoke order? Reach our Concierge Atelier at<br>
                <a href="mailto:support@deluzexlighting.com" style="color: #d4af37; text-decoration: none; font-weight: 600;">support@deluzexlighting.com</a>
              </p>
              <p style="margin: 0; font-size: 11px; color: #52525b;">
                &copy; Deluzex Luxury Lighting. Crafted with timeless sophistication. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""


def build_order_confirmation_email_text(order: Dict[str, Any]) -> str:
    order_id = str(order.get("_id") or order.get("id") or "")
    short_id = order_id[:8].upper() if order_id else "DELUXE"
    
    addr = order.get("shipping_address") or {}
    first_name = addr.get("first_name", "")
    last_name = addr.get("last_name", "")
    customer_name = f"{first_name} {last_name}".strip() or "Valued Client"
    
    total = float(order.get("total") or 0.0)
    items = order.get("items") or []
    
    lines = [
        f"DELUZEX LUXURY LIGHTING - ORDER CONFIRMATION #{short_id}",
        "===========================================================",
        f"Hello {customer_name},",
        "Thank you for your order with Deluzex. We have received your order and our atelier is preparing it.",
        "",
        "ORDER ITEMS:",
    ]
    for item in items:
        title = item.get("title") or item.get("name") or "Luminaire"
        qty = item.get("quantity") or 1
        price = item.get("price") or 0.0
        lines.append(f"- {title} x {qty} @ Rs.{price:,.2f}")
    
    lines.extend([
        "",
        f"TOTAL AMOUNT: Rs.{total:,.2f}",
        f"PAYMENT METHOD: {str(order.get('payment_method', 'Online')).upper()}",
        "",
        "SHIPPING ADDRESS:",
        f"{customer_name}",
        f"{addr.get('street', '')}",
        f"{addr.get('city', '')}, {addr.get('state', '')} - {addr.get('pin_code', '')}",
        f"Phone: {order.get('phone') or addr.get('phone', '')}",
        "",
        "Need help? Contact concierge at support@deluzexlighting.com",
    ])
    return "\n".join(lines)


def send_order_confirmation_email(order: Any) -> Dict[str, Any]:
    try:
        if hasattr(order, "model_dump"):
            order_data = order.model_dump(by_alias=True)
        elif isinstance(order, dict):
            order_data = order
        else:
            order_data = dict(order)

        to_email = (order_data.get("email") or "").strip()
        if not to_email:
            return {"success": False, "error": "No recipient email address in order."}

        order_id = str(order_data.get("_id") or order_data.get("id") or "")
        short_id = order_id[:8].upper() if order_id else "DELUXE"

        subject = f"Order Confirmation #{short_id} - Deluzex Luxury Lighting"
        html_body = build_order_confirmation_email_html(order_data)
        text_body = build_order_confirmation_email_text(order_data)

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.SMTP_FROM_EMAIL
        msg["To"] = to_email.lower()
        msg.attach(MIMEText(text_body, "plain", "utf-8"))
        msg.attach(MIMEText(html_body, "html", "utf-8"))

        return _send_smtp_message(msg, to_email.lower())
    except Exception as exc:
        logger.error(f"Failed to send order confirmation email: {exc}")
        return {"success": False, "error": str(exc)}

