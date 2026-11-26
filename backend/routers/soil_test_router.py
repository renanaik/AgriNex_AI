from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from database import get_db
from models import User, Farm, SoilTest, SoilImage
from schemas import SoilTestCreate, SoilTestResponse, DashboardStats
from dependencies import get_current_user

router = APIRouter(prefix="/api/soil-tests", tags=["Soil Tests"])


def compute_status(ph: float, nitrogen: float) -> str:
    """Determine soil health status based on pH and nitrogen levels."""
    if ph < 5.0 or ph > 8.5 or nitrogen < 50:
        return "Poor"
    if ph < 5.5 or ph > 8.0 or nitrogen < 100:
        return "Needs Attention"
    return "Healthy"


@router.post("/", response_model=SoilTestResponse, status_code=status.HTTP_201_CREATED)
def create_soil_test(
    data: SoilTestCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new soil test. Status is auto-computed from pH and nitrogen."""
    # If farm_id provided, verify ownership
    if data.farm_id is not None:
        farm = db.query(Farm).filter(
            Farm.id == data.farm_id, Farm.user_id == current_user.id
        ).first()
        if not farm:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Farm not found or not owned by you",
            )

    # If soil_image_id provided, verify ownership
    if data.soil_image_id is not None:
        image = db.query(SoilImage).filter(
            SoilImage.id == data.soil_image_id, SoilImage.user_id == current_user.id
        ).first()
        if not image:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Soil image not found or not owned by you",
            )

    soil_test = SoilTest(
        user_id=current_user.id,
        farm_id=data.farm_id,
        soil_image_id=data.soil_image_id,
        nitrogen=data.nitrogen,
        phosphorus=data.phosphorus,
        potassium=data.potassium,
        ph=data.ph,
        organic_matter=data.organic_matter,
        moisture=data.moisture,
        status=compute_status(data.ph, data.nitrogen),
        notes=data.notes,
    )
    db.add(soil_test)
    db.commit()
    db.refresh(soil_test)
    return SoilTestResponse.model_validate(soil_test)


@router.get("/", response_model=List[SoilTestResponse])
def list_soil_tests(
    farm_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all soil tests for the current user, optionally filtered by farm_id."""
    query = db.query(SoilTest).filter(SoilTest.user_id == current_user.id)
    if farm_id is not None:
        query = query.filter(SoilTest.farm_id == farm_id)
    tests = query.all()
    return [SoilTestResponse.model_validate(t) for t in tests]


@router.get("/stats", response_model=DashboardStats)
def get_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return dashboard statistics for the current user's soil tests."""
    tests = db.query(SoilTest).filter(SoilTest.user_id == current_user.id).all()

    total = len(tests)
    healthy = sum(1 for t in tests if t.status == "Healthy")
    attention = sum(1 for t in tests if t.status == "Needs Attention")
    poor = sum(1 for t in tests if t.status == "Poor")

    return DashboardStats(
        total_tests=total,
        healthy_count=healthy,
        attention_count=attention,
        poor_count=poor,
    )


@router.get("/{test_id}", response_model=SoilTestResponse)
def get_soil_test(
    test_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a single soil test by ID. Check ownership."""
    test = db.query(SoilTest).filter(
        SoilTest.id == test_id, SoilTest.user_id == current_user.id
    ).first()
    if not test:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Soil test not found")
    return SoilTestResponse.model_validate(test)


@router.delete("/{test_id}", status_code=status.HTTP_200_OK)
def delete_soil_test(
    test_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a soil test. Check ownership."""
    test = db.query(SoilTest).filter(
        SoilTest.id == test_id, SoilTest.user_id == current_user.id
    ).first()
    if not test:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Soil test not found")

    db.delete(test)
    db.commit()
    return {"message": "Soil test deleted successfully"}
