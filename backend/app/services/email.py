import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Dict, Any
from app.core.config import settings

logger = logging.getLogger("deluzex.email")

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

def send_verification_email(to_email: str, otp: str, user_name: str = "") -> Dict[str, Any]:
    """
    Sends an OTP verification email using GoDaddy / Titan SMTP (support@deluzexlighting.com).
    """
    to_clean = to_email.strip().lower()
    subject = f"Your Deluzex Verification Code: {otp}"
    html_content = build_otp_email_html(otp=otp, user_name=user_name)

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_FROM_EMAIL
    msg["To"] = to_clean

    text_part = MIMEText(
        f"Your Deluzex Verification Code is: {otp}\nValid for 10 minutes. Please enter this code to verify your account.",
        "plain"
    )
    html_part = MIMEText(html_content, "html")

    msg.attach(text_part)
    msg.attach(html_part)

    host = settings.SMTP_HOST.strip() or "smtpout.secureserver.net"
    port = int(settings.SMTP_PORT or 465)
    user = settings.SMTP_USER.strip()
    password = settings.SMTP_PASSWORD.strip()

    try:
        if port == 465:
            with smtplib.SMTP_SSL(host, port, timeout=12) as server:
                server.login(user, password)
                server.sendmail(user, [to_clean], msg.as_string())
        else:
            with smtplib.SMTP(host, port, timeout=12) as server:
                server.starttls()
                server.login(user, password)
                server.sendmail(user, [to_clean], msg.as_string())

        logger.info(f"Verification email sent successfully to {to_clean} via SMTP ({host}:{port})")
        return {"success": True}
    except Exception as e:
        logger.exception(f"SMTP failed to send verification email to {to_clean}: {e}")
        return {"success": False, "error": str(e)}

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
    """
    Sends a Password Reset OTP email using GoDaddy SMTP.
    """
    to_clean = to_email.strip().lower()
    subject = f"Your Deluzex Password Reset Code: {otp}"
    html_content = build_password_reset_email_html(otp=otp, user_name=user_name)

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_FROM_EMAIL
    msg["To"] = to_clean

    text_part = MIMEText(
        f"Your Deluzex Password Reset Code is: {otp}\nValid for 10 minutes. If you did not request this, please ignore.",
        "plain"
    )
    html_part = MIMEText(html_content, "html")

    msg.attach(text_part)
    msg.attach(html_part)

    host = settings.SMTP_HOST.strip() or "smtpout.secureserver.net"
    port = int(settings.SMTP_PORT or 465)
    user = settings.SMTP_USER.strip()
    password = settings.SMTP_PASSWORD.strip()

    try:
        if port == 465:
            with smtplib.SMTP_SSL(host, port, timeout=12) as server:
                server.login(user, password)
                server.sendmail(user, [to_clean], msg.as_string())
        else:
            with smtplib.SMTP(host, port, timeout=12) as server:
                server.starttls()
                server.login(user, password)
                server.sendmail(user, [to_clean], msg.as_string())

        logger.info(f"Password reset email sent successfully to {to_clean} via SMTP ({host}:{port})")
        return {"success": True}
    except Exception as e:
        logger.exception(f"SMTP failed to send password reset email to {to_clean}: {e}")
        return {"success": False, "error": str(e)}

