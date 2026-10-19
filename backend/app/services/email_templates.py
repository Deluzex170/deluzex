"""Stored email content with a small, non-executable placeholder language."""
import re
from html import escape
from app.core.database import db

VARIABLES = ["otp", "user_name", "expires_minutes", "brand_name", "support_email"]
EVENTS = {"verification": "Email verification", "password_reset": "Password reset"}
TOKEN = re.compile(r"\{\{\s*([a-z_]+)\s*\}\}")


def defaults():
    from app.services.email import build_otp_email_html, build_password_reset_email_html
    return [
        {"name": "Email verification", "event": "verification",
         "subject": "Your Deluzex verification code",
         "text_body": "Hello {{user_name}}, your {{brand_name}} verification code is {{otp}}. Valid for {{expires_minutes}} minutes.",
         "html_body": build_otp_email_html("{{otp}}", "{{user_name}}")},
        {"name": "Password reset", "event": "password_reset",
         "subject": "Reset your Deluzex password",
         "text_body": "Hello {{user_name}}, your password reset code is {{otp}}. Valid for {{expires_minutes}} minutes. If you did not request this, ignore this email.",
         "html_body": build_password_reset_email_html("{{otp}}", "{{user_name}}")},
    ]


def validate_content(subject, text_body, html_body, event=None):
    if "\r" in subject or "\n" in subject:
        raise ValueError("The subject must be a single line.")
    for value in (subject, text_body, html_body):
        tokens = TOKEN.findall(value)
        if any(token not in VARIABLES for token in tokens):
            raise ValueError("Unknown placeholder. Use: " + ", ".join(VARIABLES))
        if "{{" in TOKEN.sub("", value) or "}}" in TOKEN.sub("", value):
            raise ValueError("Invalid placeholder. Use {{variable_name}}.")
    if event:
        if "otp" not in TOKEN.findall(text_body) or "otp" not in TOKEN.findall(html_body):
            raise ValueError("Active OTP templates must include {{otp}} in both text and HTML bodies.")


def render_content(template, values):
    def render(value, html=False):
        return TOKEN.sub(lambda match: escape(str(values[match[1]]), quote=True) if html
                         else str(values[match[1]]), value)
    return {"subject": render(template["subject"]).replace("\r", " ").replace("\n", " "),
            "text_body": render(template["text_body"]), "html_body": render(template["html_body"], True)}


def render_email(event, otp, user_name=""):
    binding = db.email_template_bindings.find_one({"_id": event})
    template = db.email_templates.find_one({"_id": binding["template_id"]}) if binding else None
    if template is None:
        template = next(item for item in defaults() if item["event"] == event)
    return render_content(template, {"otp": otp, "user_name": user_name or "Valued Client",
                                   "expires_minutes": "10", "brand_name": "Deluzex",
                                   "support_email": "support@deluzexlighting.com"})
