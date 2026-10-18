from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        case_sensitive=True,
        env_file=(".env.local", ".env", "backend/.env.local", "backend/.env"),
        extra="ignore",
    )

    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "deluzex-backend"
    RAZORPAY_KEY_ID: str = "rzp_test_TpVQEuXPqCh2wV"
    RAZORPAY_KEY_SECRET: str = "kV7L3QKILQMkRbi5KMPzlCES"
    # Live credentials (set in production env or uncomment):
    # RAZORPAY_KEY_ID: str = "rzp_live_TbWTJXI8sczsqx"
    # RAZORPAY_KEY_SECRET: str = "gmKiSY1ZvSfG05ZMfKctN42j"
    RAZORPAY_WEBHOOK_SECRET: str = "deluzex_webhook_secret_2026"

settings = Settings()
