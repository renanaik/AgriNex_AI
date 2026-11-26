from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from models import User, Farm, SoilImage, SoilTest, SoilAnalysis
from schemas import (
    FarmCreate, FarmUpdate, FarmResponse,
    SoilImageResponse, SoilTestResponse, SoilAnalysisResponse,
    FarmHistoryResponse, FarmHistoryItem
)
from dependencies import get_current_user
from routers.image_router import build_soil_image_response, build_analysis_response

router = APIRouter(prefix="/api/farms", tags=["Farms"])


@router.post("/", response_model=FarmResponse, status_code=status.HTTP_201_CREATED)
def create_farm(
    data: FarmCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new farm for the authenticated user."""
    farm = Farm(
        user_id=current_user.id,
        farm_name=data.farm_name,
        field_name=data.field_name,
        location=data.location,
        area=data.area,
        soil_type=data.soil_type,
    )
    db.add(farm)
    db.commit()
    db.refresh(farm)
    return FarmResponse.model_validate(farm)


@router.get("/", response_model=List[FarmResponse])
def list_farms(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all farms owned by the authenticated user."""
    farms = db.query(Farm).filter(Farm.user_id == current_user.id).order_by(Farm.created_at.desc()).all()
    return [FarmResponse.model_validate(f) for f in farms]


@router.get("/{farm_id}", response_model=FarmResponse)
def get_farm(
    farm_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a single farm by ID. Returns 404 if not found or not owned by user."""
    farm = db.query(Farm).filter(Farm.id == farm_id, Farm.user_id == current_user.id).first()
    if not farm:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Farm not found")
    return FarmResponse.model_validate(farm)


@router.put("/{farm_id}", response_model=FarmResponse)
def update_farm(
    farm_id: int,
    data: FarmUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update a farm. Only the owner can update."""
    farm = db.query(Farm).filter(Farm.id == farm_id, Farm.user_id == current_user.id).first()
    if not farm:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Farm not found")

    if data.farm_name is not None:
        farm.farm_name = data.farm_name
    if data.field_name is not None:
        farm.field_name = data.field_name
    if data.location is not None:
        farm.location = data.location
    if data.area is not None:
        farm.area = data.area
    if data.soil_type is not None:
        farm.soil_type = data.soil_type

    db.commit()
    db.refresh(farm)
    return FarmResponse.model_validate(farm)


@router.delete("/{farm_id}", status_code=status.HTTP_200_OK)
def delete_farm(
    farm_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a farm. Only the owner can delete."""
    farm = db.query(Farm).filter(Farm.id == farm_id, Farm.user_id == current_user.id).first()
    if not farm:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Farm not found")

    db.delete(farm)
    db.commit()
    return {"message": "Farm deleted successfully"}


# ── Farm Historical Soil Analysis & Records Endpoints ─────────────────────────

@router.get("/{farm_id}/images", response_model=List[SoilImageResponse])
def get_farm_images(
    farm_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all persistent soil images belonging to this farm."""
    farm = db.query(Farm).filter(Farm.id == farm_id, Farm.user_id == current_user.id).first()
    if not farm:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Farm not found")

    images = db.query(SoilImage).filter(
        SoilImage.farm_id == farm_id, SoilImage.user_id == current_user.id
    ).order_by(SoilImage.uploaded_at.desc()).all()

    return [build_soil_image_response(img) for img in images]


@router.get("/{farm_id}/soil-tests", response_model=List[SoilTestResponse])
def get_farm_soil_tests(
    farm_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all structured soil-test laboratory readings for this farm."""
    farm = db.query(Farm).filter(Farm.id == farm_id, Farm.user_id == current_user.id).first()
    if not farm:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Farm not found")

    tests = db.query(SoilTest).filter(
        SoilTest.farm_id == farm_id, SoilTest.user_id == current_user.id
    ).order_by(SoilTest.tested_at.desc()).all()

    return [SoilTestResponse.model_validate(t) for t in tests]


@router.get("/{farm_id}/analyses", response_model=List[SoilAnalysisResponse])
def get_farm_analyses(
    farm_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all persistent AI classification results for this farm."""
    farm = db.query(Farm).filter(Farm.id == farm_id, Farm.user_id == current_user.id).first()
    if not farm:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Farm not found")

    analyses = db.query(SoilAnalysis).filter(
        SoilAnalysis.farm_id == farm_id, SoilAnalysis.user_id == current_user.id
    ).order_by(SoilAnalysis.analyzed_at.desc()).all()

    return [build_analysis_response(a) for a in analyses]


@router.get("/{farm_id}/latest-analysis", response_model=Optional[SoilAnalysisResponse])
def get_farm_latest_analysis(
    farm_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get the most recent AI classification result for this farm."""
    farm = db.query(Farm).filter(Farm.id == farm_id, Farm.user_id == current_user.id).first()
    if not farm:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Farm not found")

    latest = db.query(SoilAnalysis).filter(
        SoilAnalysis.farm_id == farm_id, SoilAnalysis.user_id == current_user.id
    ).order_by(SoilAnalysis.analyzed_at.desc()).first()

    if not latest:
        return None

    return build_analysis_response(latest)


@router.get("/{farm_id}/history", response_model=FarmHistoryResponse)
def get_farm_history(
    farm_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get comprehensive historical soil records and analysis timeline for a farm field:
    - Farm metadata
    - Total counts
    - All soil tests
    - All soil images with latest classification
    - Chronological timeline combining laboratory chemical tests and AI visual analyses
    """
    farm = db.query(Farm).filter(Farm.id == farm_id, Farm.user_id == current_user.id).first()
    if not farm:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Farm not found")

    images = db.query(SoilImage).filter(
        SoilImage.farm_id == farm_id, SoilImage.user_id == current_user.id
    ).order_by(SoilImage.uploaded_at.desc()).all()

    tests = db.query(SoilTest).filter(
        SoilTest.farm_id == farm_id, SoilTest.user_id == current_user.id
    ).order_by(SoilTest.tested_at.desc()).all()

    analyses = db.query(SoilAnalysis).filter(
        SoilAnalysis.farm_id == farm_id, SoilAnalysis.user_id == current_user.id
    ).order_by(SoilAnalysis.analyzed_at.desc()).all()

    # Build chronological timeline items
    def _ensure_utc(dt):
        if dt is None:
            return datetime.now(timezone.utc)
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)

    timeline: List[FarmHistoryItem] = []

    for t in tests:
        dt = _ensure_utc(t.tested_at or farm.created_at)
        timeline.append(
            FarmHistoryItem(
                id=f"test_{t.id}",
                type="soil_test",
                timestamp=dt,
                title=f"Lab Soil Test #{t.id} - Status: {t.status}",
                summary=f"pH: {t.ph}, N: {t.nitrogen} mg/kg, P: {t.phosphorus} mg/kg, K: {t.potassium} mg/kg",
                details={
                    "test_id": t.id,
                    "nitrogen": t.nitrogen,
                    "phosphorus": t.phosphorus,
                    "potassium": t.potassium,
                    "ph": t.ph,
                    "organic_matter": t.organic_matter,
                    "moisture": t.moisture,
                    "status": t.status,
                    "notes": t.notes,
                },
            )
        )

    for a in analyses:
        dt = _ensure_utc(a.analyzed_at or farm.created_at)
        pred_title = a.predicted_soil_type.replace("_", " ")
        timeline.append(
            FarmHistoryItem(
                id=f"analysis_{a.id}",
                type="image_analysis",
                timestamp=dt,
                title=f"AI Soil Classification #{a.id} - {pred_title}",
                summary=f"Predicted {pred_title} with {round(a.confidence, 1)}% confidence ({a.model_name})",
                details={
                    "analysis_id": a.id,
                    "soil_image_id": a.soil_image_id,
                    "predicted_soil_type": a.predicted_soil_type,
                    "confidence": a.confidence,
                    "probabilities": a.probabilities,
                    "model_name": a.model_name,
                    "model_version": a.model_version,
                    "analysis_status": a.analysis_status,
                },
            )
        )

    # Sort combined timeline descending by timestamp
    timeline.sort(key=lambda item: item.timestamp, reverse=True)

    latest_analysis_resp = build_analysis_response(analyses[0]) if analyses else None

    return FarmHistoryResponse(
        farm=FarmResponse.model_validate(farm),
        total_images=len(images),
        total_tests=len(tests),
        total_analyses=len(analyses),
        latest_analysis=latest_analysis_resp,
        images=[build_soil_image_response(img) for img in images],
        soil_tests=[SoilTestResponse.model_validate(t) for t in tests],
        analyses=[build_analysis_response(a) for a in analyses],
        timeline=timeline,
    )
