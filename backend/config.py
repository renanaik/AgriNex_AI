import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env file from backend directory if present
env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path)

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/soil_health_db"
)
JWT_SECRET = os.getenv("JWT_SECRET", "change-this-in-production-soil-health-secret-key-2026")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
SOIL_IMAGES_DIR = os.path.join(UPLOAD_DIR, "soil_images")
PROCESSED_DIR = os.path.join(os.path.dirname(__file__), "processed")
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "webp"}
ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}
