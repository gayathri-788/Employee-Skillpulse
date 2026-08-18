import os

# Database Configuration
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./database.db")

# CORS Configuration - comma-separated list of allowed frontend origins
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")
    if origin.strip()
]

# Security Configuration
JWT_SECRET = os.getenv("JWT_SECRET", "super-secret-arohak-token-key-change-in-prod-12345!")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 1 day expiration for tokens

# Admin Seed configuration
DEFAULT_ADMIN_USERNAME = "admin"
DEFAULT_ADMIN_PASSWORD = "adminpassword123"
DEFAULT_EMPLOYEE_PASSWORD = "Password@123"

# SMTP Email Configuration
SMTP_SERVER = os.getenv("SMTP_SERVER", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_SENDER = os.getenv("SMTP_SENDER", "noreply@arohak-skillpulse.com")
SMTP_USE_TLS = os.getenv("SMTP_USE_TLS", "True").lower() == "true"

