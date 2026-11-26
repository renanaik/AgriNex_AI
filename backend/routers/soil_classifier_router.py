import io
import os
import time
import uuid
import logging
from typing import Optional, Dict, Any
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, status, Header, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel

from database import get_db
from models import User, SoilImage, Farm, SoilTest, SoilAnalysis
from auth import decode_access_token
from soil_classifier import classifier_service, SOIL_INFO, DISCLAIMER_TEXT
from config import SOIL_IMAGES_DIR

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/soil", tags=["Soil Classification"])


class SoilInfoSchema(BaseModel):
    name_en: str
    name_gu: str
    description: str
    typical_crops: str
    characteristics: str


class SoilClassificationResponse(BaseModel):
    predicted_soil: str
    predicted_soil_name: str
    confidence: float
    probabilities: Dict[str, float]
    soil_info: Optional[SoilInfoSchema] = None
    disclaimer: str
    analysis_id: Optional[int] = None
    soil_image_id: Optional[int] = None
    farm_id: Optional[int] = None


def get_optional_user(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """Extract authenticated user if Authorization header is provided; otherwise return None."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization[len("Bearer "):]
    payload = decode_access_token(token)
    if not payload:
        return None
    user_id_str = payload.get("sub")
    if not user_id_str:
        return None
    try:
        user_id = int(user_id_str)
        return db.query(User).filter(User.id == user_id).first()
    except Exception:
        return None


@router.post(
    "/classify-image",
    response_model=SoilClassificationResponse,
    status_code=status.HTTP_200_OK,
    summary="Classify soil photograph into 7 soil categories using trained MobileNetV3-Small",
)
async def classify_soil_image(
    file: Optional[UploadFile] = File(None),
    soil_image_id: Optional[int] = Form(None),
    farm_id: Optional[int] = Form(None),
    soil_test_id: Optional[int] = Form(None),
    current_user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    """
    Classify a soil photograph and optionally associate and persist results:
    - Pass `file`: classifies the uploaded photo directly.
    - Pass `soil_image_id`: classifies an existing persistent image and saves the analysis record.
    - If `current_user` is authenticated and `farm_id` or `soil_image_id` is supplied,
      the classification is persistently saved in the PostgreSQL `soil_analyses` table.
    """
    if not classifier_service.is_loaded:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Soil classification model is not available or failed to initialize on startup.",
        )

    pil_image = None
    target_image: Optional[SoilImage] = None

    # Option A: Classify existing stored soil image by ID
    if soil_image_id is not None:
        if not current_user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required to classify stored image records.",
            )
        target_image = db.query(SoilImage).filter(
            SoilImage.id == soil_image_id, SoilImage.user_id == current_user.id
        ).first()
        if not target_image:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Stored soil image not found or not owned by you.",
            )
        if not os.path.exists(target_image.file_path):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Image file not found on disk.",
            )
        try:
            with open(target_image.file_path, "rb") as f:
                content = f.read()
            pil_image = classifier_service.validate_image_bytes(content, filename=target_image.original_filename)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Could not load image: {e}",
            )

    # Option B: Classify uploaded file
    elif file is not None:
        try:
            content = await file.read()
        except Exception as e:
            logger.error(f"Failed to read uploaded file: {e}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to read the uploaded image file.",
            )
        try:
            pil_image = classifier_service.validate_image_bytes(content, filename=file.filename or "")
        except ValueError as val_err:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=str(val_err),
            )
    else:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Either 'file' or 'soil_image_id' must be provided.",
        )

    # Run ML Inference
    try:
        result = classifier_service.classify_image(pil_image)
    except Exception as e:
        logger.error(f"Inference error during soil classification: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Inference error during soil classification: {str(e)}",
        )

    analysis_id = None
    saved_soil_image_id = None
    final_farm_id = farm_id

    # If associating with an existing image record
    if target_image and current_user:
        analysis = SoilAnalysis(
            soil_image_id=target_image.id,
            user_id=current_user.id,
            farm_id=target_image.farm_id,
            predicted_soil_type=result["predicted_soil"],
            confidence=result["confidence"],
            probabilities=result["probabilities"],
            model_name="MobileNetV3-Small",
            model_version="1.0.0",
            analysis_status="completed",
        )
        db.add(analysis)
        db.commit()
        db.refresh(analysis)
        analysis_id = analysis.id
        saved_soil_image_id = target_image.id
        final_farm_id = target_image.farm_id

    # If user provided file and farm_id together on this endpoint
    elif current_user and farm_id is not None and file is not None:
        target_farm = db.query(Farm).filter(Farm.id == farm_id, Farm.user_id == current_user.id).first()
        if not target_farm:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Farm not found or not owned by you.",
            )

        dest_dir = os.path.join(SOIL_IMAGES_DIR, f"farm_{farm_id}")
        os.makedirs(dest_dir, exist_ok=True)
        ext = file.filename.rsplit(".", 1)[-1].lower() if "." in (file.filename or "") else "jpg"
        stored_filename = f"soil_{uuid.uuid4().hex[:12]}_{int(time.time())}.{ext}"
        file_path = os.path.join(dest_dir, stored_filename)

        with open(file_path, "wb") as f:
            f.write(content)

        new_image = SoilImage(
            user_id=current_user.id,
            farm_id=farm_id,
            soil_test_id=soil_test_id,
            original_filename=file.filename or "unknown",
            stored_filename=stored_filename,
            file_path=file_path,
            file_size=len(content),
            mime_type=file.content_type or "image/jpeg",
        )
        db.add(new_image)
        db.flush()

        analysis = SoilAnalysis(
            soil_image_id=new_image.id,
            user_id=current_user.id,
            farm_id=farm_id,
            predicted_soil_type=result["predicted_soil"],
            confidence=result["confidence"],
            probabilities=result["probabilities"],
            model_name="MobileNetV3-Small",
            model_version="1.0.0",
            analysis_status="completed",
        )
        db.add(analysis)
        db.commit()
        db.refresh(analysis)
        analysis_id = analysis.id
        saved_soil_image_id = new_image.id

    return SoilClassificationResponse(
        predicted_soil=result["predicted_soil"],
        predicted_soil_name=result["predicted_soil_name"],
        confidence=result["confidence"],
        probabilities=result["probabilities"],
        soil_info=SoilInfoSchema(**result["soil_info"]) if result.get("soil_info") else None,
        disclaimer=result["disclaimer"],
        analysis_id=analysis_id,
        soil_image_id=saved_soil_image_id,
        farm_id=final_farm_id,
    )
