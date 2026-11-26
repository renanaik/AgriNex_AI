import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from config import DATABASE_URL

logger = logging.getLogger("uvicorn.error")

if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL is not set. Please configure DATABASE_URL in backend/.env"
    )

try:
    engine = create_engine(DATABASE_URL, pool_pre_ping=True)
    # Validate connection to PostgreSQL immediately
    with engine.connect():
        pass
    logger.info("[Database] Connected to PostgreSQL successfully.")
except Exception as e:
    logger.error(f"[Database] Failed to connect to PostgreSQL: {e}")
    raise RuntimeError(
        f"Failed to connect to PostgreSQL database: {e}. "
        "Please ensure PostgreSQL is running and check your connection settings in backend/.env."
    ) from e

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """Dependency that yields a database session and closes it after use."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
