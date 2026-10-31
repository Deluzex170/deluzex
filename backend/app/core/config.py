from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        case_sensitive=True,
        env_file=(".env.local", ".env", "backend/.env.local", "backend/.env", "../.env.local", "../.env"),
        extra="ignore",
    )

    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "deluzex-backend"
    SECRET_KEY: str = "deluzex_production_jwt_secret_change_me_super_secure_key_2026"
    ALGORITHM: str = "HS256"
    RAZORPAY_KEY_ID: str = ""
    RAZORPAY_KEY_SECRET: str = ""
    RAZORPAY_WEBHOOK_SECRET: str = ""

    # WhatsApp Cloud API Configuration (Direct Meta)
    WHATSAPP_PHONE_NUMBER_ID: str = ""
    WHATSAPP_ACCESS_TOKEN: str = ""
    WHATSAPP_TEMPLATE_NAME: str = "auth"

    # MSG91 WhatsApp Configuration
    MSG91_AUTH_KEY: str = ""
    MSG91_INTEGRATED_NUMBER: str = "17115086207"
    MSG91_WABA_ID: str = "932004503106631"
    MSG91_WHATSAPP_TEMPLATE_NAME: str = "deluzex_otp"

    # GoDaddy SMTP Email Configuration
    SMTP_HOST: str = "smtpout.secureserver.net"
    SMTP_PORT: int = 465
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = "Deluzex Lighting <support@deluzexlighting.com>"
    ADMIN_INQUIRY_EMAIL: str = "info@deluzexlighting.com"

    # Shiprocket Logistics Configuration
    SHIPROCKET_EMAIL: str = "deluzexdata+api@gmail.com"
    SHIPROCKET_PASSWORD: str = ""
    SHIPROCKET_API_BASE: str = "https://apiv2.shiprocket.in/v1/external"
    SHIPROCKET_PICKUP_LOCATION: str = "work"
    SHIPROCKET_PICKUP_PINCODE: str = "385210"
    SHIPROCKET_DEFAULT_WEIGHT: float = 1.5
    SHIPROCKET_DEFAULT_LENGTH: float = 30.0
    SHIPROCKET_DEFAULT_BREADTH: float = 30.0
    SHIPROCKET_DEFAULT_HEIGHT: float = 20.0
    SHIPROCKET_WEBHOOK_SECRET: str = ""

settings = Settings()
