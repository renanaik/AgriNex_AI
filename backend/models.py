from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, Float, Text, DateTime, ForeignKey, JSON
)
from sqlalchemy.orm import relationship
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    full_name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, nullable=False, index=True)
    phone = Column(String(20), nullable=True)
    password_hash = Column(String(255), nullable=False)
    language_preference = Column(String(10), default="en")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    farms = relationship("Farm", back_populates="user", cascade="all, delete-orphan")
    soil_tests = relationship("SoilTest", back_populates="user", cascade="all, delete-orphan")
    soil_images = relationship("SoilImage", back_populates="user", cascade="all, delete-orphan")
    soil_analyses = relationship("SoilAnalysis", back_populates="user", cascade="all, delete-orphan")


class Farm(Base):
    __tablename__ = "farms"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    farm_name = Column(String(100), nullable=False)
    field_name = Column(String(100), nullable=True)
    location = Column(String(200), nullable=True)
    area = Column(Float, nullable=True)  # in acres
    soil_type = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="farms")
    soil_tests = relationship("SoilTest", back_populates="farm", cascade="all, delete-orphan")
    soil_images = relationship("SoilImage", back_populates="farm", cascade="all, delete-orphan")
    soil_analyses = relationship("SoilAnalysis", back_populates="farm", cascade="all, delete-orphan")


class SoilTest(Base):
    __tablename__ = "soil_tests"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    farm_id = Column(Integer, ForeignKey("farms.id"), nullable=True, index=True)
    soil_image_id = Column(Integer, ForeignKey("soil_images.id", ondelete="SET NULL"), nullable=True, index=True)
    nitrogen = Column(Float, nullable=False)  # mg/kg
    phosphorus = Column(Float, nullable=False)  # mg/kg
    potassium = Column(Float, nullable=False)  # mg/kg
    ph = Column(Float, nullable=False)
    organic_matter = Column(Float, nullable=True)  # %
    moisture = Column(Float, nullable=True)  # %
    status = Column(String(20), nullable=False)
    notes = Column(Text, nullable=True)
    tested_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="soil_tests")
    farm = relationship("Farm", back_populates="soil_tests")
    soil_image = relationship("SoilImage", foreign_keys=[soil_image_id], post_update=True)


class SoilImage(Base):
    __tablename__ = "soil_images"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    farm_id = Column(Integer, ForeignKey("farms.id"), nullable=True, index=True)
    soil_test_id = Column(Integer, ForeignKey("soil_tests.id"), nullable=True, index=True)
    original_filename = Column(String(255), nullable=False)
    stored_filename = Column(String(255), nullable=False, unique=True)
    file_path = Column(String(500), nullable=False)
    processed_path = Column(String(500), nullable=True)
    file_size = Column(Integer, nullable=False)  # bytes
    mime_type = Column(String(50), nullable=False)
    uploaded_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="soil_images")
    farm = relationship("Farm", back_populates="soil_images")
    soil_test = relationship("SoilTest", foreign_keys=[soil_test_id])
    analyses = relationship(
        "SoilAnalysis",
        back_populates="image",
        cascade="all, delete-orphan",
        order_by="desc(SoilAnalysis.analyzed_at)"
    )


class SoilAnalysis(Base):
    __tablename__ = "soil_analyses"

    id = Column(Integer, primary_key=True, autoincrement=True)
    soil_image_id = Column(Integer, ForeignKey("soil_images.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    farm_id = Column(Integer, ForeignKey("farms.id", ondelete="CASCADE"), nullable=True, index=True)
    predicted_soil_type = Column(String(50), nullable=False)
    confidence = Column(Float, nullable=False)
    probabilities = Column(JSON, nullable=False)
    model_name = Column(String(100), default="MobileNetV3-Small", nullable=False)
    model_version = Column(String(50), default="1.0.0", nullable=True)
    analysis_status = Column(String(20), default="completed", nullable=False)
    analyzed_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    image = relationship("SoilImage", back_populates="analyses")
    user = relationship("User", back_populates="soil_analyses")
    farm = relationship("Farm", back_populates="soil_analyses")
