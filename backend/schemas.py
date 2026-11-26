from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, ConfigDict, EmailStr, Field


# ── User Schemas ──────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=100)
    email: str = Field(..., min_length=1, max_length=150)
    password: str = Field(..., min_length=6)
    phone: Optional[str] = Field(None, max_length=20)
    language_preference: str = Field("en", max_length=10)


class UserLogin(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    email: str
    phone: Optional[str] = None
    language_preference: str
    created_at: datetime


class UserUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=1, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    language_preference: Optional[str] = Field(None, max_length=10)


class TokenResponse(BaseModel):
    user: UserResponse
    token: str


# ── Farm Schemas ──────────────────────────────────────────────────────────────

class FarmCreate(BaseModel):
    farm_name: str = Field(..., min_length=1, max_length=100)
    field_name: Optional[str] = Field(None, max_length=100)
    location: Optional[str] = Field(None, max_length=200)
    area: Optional[float] = Field(None, ge=0)
    soil_type: Optional[str] = Field(None, max_length=50)


class FarmUpdate(BaseModel):
    farm_name: Optional[str] = Field(None, min_length=1, max_length=100)
    field_name: Optional[str] = Field(None, max_length=100)
    location: Optional[str] = Field(None, max_length=200)
    area: Optional[float] = Field(None, ge=0)
    soil_type: Optional[str] = Field(None, max_length=50)


class FarmResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    farm_name: str
    field_name: Optional[str] = None
    location: Optional[str] = None
    area: Optional[float] = None
    soil_type: Optional[str] = None
    created_at: datetime


# ── Soil Test Schemas ─────────────────────────────────────────────────────────

class SoilTestCreate(BaseModel):
    farm_id: Optional[int] = None
    soil_image_id: Optional[int] = None
    nitrogen: float = Field(..., ge=0, le=500)
    phosphorus: float = Field(..., ge=0, le=500)
    potassium: float = Field(..., ge=0, le=500)
    ph: float = Field(..., ge=0, le=14)
    organic_matter: Optional[float] = Field(None, ge=0, le=100)
    moisture: Optional[float] = Field(None, ge=0, le=100)
    notes: Optional[str] = None


class SoilTestResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    farm_id: Optional[int] = None
    soil_image_id: Optional[int] = None
    nitrogen: float
    phosphorus: float
    potassium: float
    ph: float
    organic_matter: Optional[float] = None
    moisture: Optional[float] = None
    status: str
    notes: Optional[str] = None
    tested_at: datetime


# ── Soil Analysis Schemas ─────────────────────────────────────────────────────

class SoilAnalysisResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    soil_image_id: int
    user_id: int
    farm_id: Optional[int] = None
    predicted_soil_type: str
    predicted_soil_name: Optional[str] = None
    confidence: float
    probabilities: Dict[str, float]
    model_name: str
    model_version: Optional[str] = None
    analysis_status: str
    analyzed_at: datetime
    soil_info: Optional[Dict[str, Any]] = None
    disclaimer: Optional[str] = None


# ── Soil Image Schemas ────────────────────────────────────────────────────────

class SoilImageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    farm_id: Optional[int] = None
    soil_test_id: Optional[int] = None
    original_filename: str
    stored_filename: str
    file_path: str
    processed_path: Optional[str] = None
    file_size: int
    mime_type: str
    uploaded_at: datetime
    latest_analysis: Optional[SoilAnalysisResponse] = None


# ── Farm History Schemas ──────────────────────────────────────────────────────

class FarmHistoryItem(BaseModel):
    id: str
    type: str  # 'soil_test' | 'image_analysis'
    timestamp: datetime
    title: str
    summary: str
    details: Dict[str, Any]


class FarmHistoryResponse(BaseModel):
    farm: FarmResponse
    total_images: int
    total_tests: int
    total_analyses: int
    latest_analysis: Optional[SoilAnalysisResponse] = None
    images: List[SoilImageResponse]
    soil_tests: List[SoilTestResponse]
    analyses: List[SoilAnalysisResponse]
    timeline: List[FarmHistoryItem]


# ── Dashboard Schemas ─────────────────────────────────────────────────────────

class DashboardStats(BaseModel):
    total_tests: int
    healthy_count: int
    attention_count: int
    poor_count: int
