import io
import os
import time
import uuid
import logging
from typing import List, Optional, Dict, Any

import cv2
import numpy as np
from PIL import Image, ImageOps, UnidentifiedImageError
from fastapi import (
    APIRouter, Depends, HTTPException, UploadFile, File, Form,
    Query, Header, Request, status
)
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from config import (
    UPLOAD_DIR, SOIL_IMAGES_DIR, PROCESSED_DIR,
    MAX_FILE_SIZE, ALLOWED_EXTENSIONS, ALLOWED_MIME_TYPES
)
from database import get_db
from models import User, SoilImage, Farm, SoilTest, SoilAnalysis
from schemas import SoilImageResponse, SoilAnalysisResponse
from dependencies import get_current_user
from auth import decode_access_token
from soil_classifier import classifier_service, SOIL_INFO, DISCLAIMER_TEXT

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/images", tags=["Images"])


def _get_extension(filename: str) -> str:
    """Extract lowercase file extension without the dot."""
    return filename.rsplit(".", 1)[-1].lower() if "." in filename else ""


def build_analysis_response(analysis: SoilAnalysis) -> SoilAnalysisResponse:
    """Format a SoilAnalysis SQLAlchemy model into SoilAnalysisResponse."""
    soil_info = SOIL_INFO.get(analysis.predicted_soil_type)
    return SoilAnalysisResponse(
        id=analysis.id,
        soil_image_id=analysis.soil_image_id,
        user_id=analysis.user_id,
        farm_id=analysis.farm_id,
        predicted_soil_type=analysis.predicted_soil_type,
        predicted_soil_name=soil_info["name_en"] if soil_info else analysis.predicted_soil_type.replace("_", " "),
        confidence=round(analysis.confidence, 2),
        probabilities=analysis.probabilities,
        model_name=analysis.model_name,
        model_version=analysis.model_version,
        analysis_status=analysis.analysis_status,
        analyzed_at=analysis.analyzed_at,
        soil_info=soil_info,
        disclaimer=DISCLAIMER_TEXT,
    )


def build_soil_image_response(image: SoilImage) -> SoilImageResponse:
    """Format a SoilImage model including its latest persistent AI analysis if available."""
    latest_resp = None
    if image.analyses and len(image.analyses) > 0:
        latest = image.analyses[0]
        latest_resp = build_analysis_response(latest)

    return SoilImageResponse(
        id=image.id,
        user_id=image.user_id,
        farm_id=image.farm_id,
        soil_test_id=image.soil_test_id,
        original_filename=image.original_filename,
        stored_filename=image.stored_filename,
        file_path=image.file_path,
        processed_path=image.processed_path,
        file_size=image.file_size,
        mime_type=image.mime_type,
        uploaded_at=image.uploaded_at,
        latest_analysis=latest_resp,
    )


def get_user_from_header_or_query(
    token: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
) -> User:
    """
    Authenticate user via Bearer header OR query param 'token'.
    Allows standard <img> HTML elements to access authenticated images securely.
    """
    jwt_str = None
    if authorization and authorization.startswith("Bearer "):
        jwt_str = authorization[len("Bearer "):]
    elif token:
        jwt_str = token

    if not jwt_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token required via Authorization header or ?token= query parameter",
        )

    payload = decode_access_token(jwt_str)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    user_id_str = payload.get("sub")
    if user_id_str is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

    try:
        user_id = int(user_id_str)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    return user


@router.post("/upload", response_model=SoilImageResponse, status_code=status.HTTP_201_CREATED)
async def upload_image(
    request: Request,
    file: UploadFile = File(...),
    farm_id: Optional[int] = Form(None),
    soil_test_id: Optional[int] = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Upload a soil image with ownership and content validation:
    1. Validates ownership of farm_id and soil_test_id (if provided).
    2. Validates that soil_test belongs to farm (if both provided).
    3. Validates file extension and claimed MIME type (JPEG, PNG, WEBP).
    4. Validates actual file content using Pillow and OpenCV.
    5. Normalizes EXIF orientation and RGB colorspace.
    6. Saves file to persistent structured storage (backend/uploads/soil_images/farm_<id>/).
    7. Runs MobileNetV3-Small classifier and saves metadata + classification to PostgreSQL.
    8. Ensures rollback and file cleanup if database operation fails.
    """
    # Fallback to query params if not provided in form body
    if farm_id is None and "farm_id" in request.query_params:
        try:
            farm_id = int(request.query_params["farm_id"])
        except ValueError:
            pass
    if soil_test_id is None and "soil_test_id" in request.query_params:
        try:
            soil_test_id = int(request.query_params["soil_test_id"])
        except ValueError:
            pass

    # 1. Ownership validation
    target_farm = None
    if farm_id is not None:
        target_farm = db.query(Farm).filter(Farm.id == farm_id, Farm.user_id == current_user.id).first()
        if not target_farm:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Farm not found or not owned by you",
            )

    target_soil_test = None
    if soil_test_id is not None:
        target_soil_test = db.query(SoilTest).filter(
            SoilTest.id == soil_test_id, SoilTest.user_id == current_user.id
        ).first()
        if not target_soil_test:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Soil test not found or not owned by you",
            )

    # Cross-entity linkage validation
    if target_farm is not None and target_soil_test is not None:
        if target_soil_test.farm_id != target_farm.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Soil test does not belong to the selected farm",
            )

    # 2. Extension validation
    ext = _get_extension(file.filename or "")
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"File extension '.{ext}' not allowed. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )

    # 3. MIME type validation
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"MIME type '{file.content_type}' not allowed. Allowed: {', '.join(sorted(ALLOWED_MIME_TYPES))}",
        )

    # 4. Read file content and check size limit (10MB)
    content = await file.read()
    if len(content) == 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Uploaded file is empty",
        )
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"File size exceeds maximum of {MAX_FILE_SIZE // (1024 * 1024)} MB",
        )

    # 5. Verify actual image content using Pillow
    normalized_pil_image = None
    try:
        with Image.open(io.BytesIO(content)) as img:
            img_format = img.format
            if img_format not in ("JPEG", "PNG", "WEBP"):
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Invalid image format '{img_format}'. Only JPEG, PNG, and WEBP images are accepted.",
                )
            img.verify()

        # Re-open for actual processing and EXIF orientation normalization
        with Image.open(io.BytesIO(content)) as img:
            try:
                normalized_pil_image = ImageOps.exif_transpose(img)
            except Exception:
                normalized_pil_image = img
            if normalized_pil_image.mode not in ("RGB", "L", "RGBA"):
                normalized_pil_image = normalized_pil_image.convert("RGB")
            else:
                normalized_pil_image = normalized_pil_image.copy()

            if normalized_pil_image.width < 10 or normalized_pil_image.height < 10:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Image dimensions are too small (minimum 10x10 px required).",
                )
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Corrupted or invalid image file content.",
        )

    # 6. Verify image decodability using OpenCV
    decoded = cv2.imdecode(np.frombuffer(content, np.uint8), cv2.IMREAD_COLOR)
    if decoded is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Image file is corrupted and could not be decoded.",
        )

    # 7. Write file to structured storage (farm directory)
    if farm_id is not None:
        dest_dir = os.path.join(SOIL_IMAGES_DIR, f"farm_{farm_id}")
    else:
        dest_dir = os.path.join(SOIL_IMAGES_DIR, f"user_{current_user.id}")

    os.makedirs(dest_dir, exist_ok=True)
    stored_filename = f"soil_{uuid.uuid4().hex[:12]}_{int(time.time())}.{ext}"
    file_path = os.path.join(dest_dir, stored_filename)

    with open(file_path, "wb") as f:
        f.write(content)

    # 8. Run MobileNetV3-Small classifier on the image
    classification_data = None
    if classifier_service.is_loaded and normalized_pil_image is not None:
        try:
            classification_data = classifier_service.classify_image(normalized_pil_image)
        except Exception as e:
            logger.warning(f"Classification during upload failed: {e}")

    # 9. Save record in database with cleanup on failure
    try:
        image = SoilImage(
            user_id=current_user.id,
            farm_id=farm_id,
            soil_test_id=soil_test_id,
            original_filename=file.filename or "unknown",
            stored_filename=stored_filename,
            file_path=file_path,
            file_size=len(content),
            mime_type=file.content_type,
        )
        db.add(image)
        db.flush()  # assign image.id

        # Save classification analysis record if classifier produced result
        if classification_data:
            analysis = SoilAnalysis(
                soil_image_id=image.id,
                user_id=current_user.id,
                farm_id=farm_id,
                predicted_soil_type=classification_data["predicted_soil"],
                confidence=classification_data["confidence"],
                probabilities=classification_data["probabilities"],
                model_name="MobileNetV3-Small",
                model_version="1.0.0",
                analysis_status="completed",
            )
            db.add(analysis)

        # Update SoilTest with reverse link if soil_test_id was provided
        if target_soil_test is not None:
            target_soil_test.soil_image_id = image.id

        db.commit()
        db.refresh(image)
        return build_soil_image_response(image)
    except Exception:
        db.rollback()
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except OSError:
                pass
        raise


@router.get("/", response_model=List[SoilImageResponse])
def list_images(
    farm_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all images belonging to current user, optionally filtered by farm_id."""
    query = db.query(SoilImage).filter(SoilImage.user_id == current_user.id)
    if farm_id is not None:
        query = query.filter(SoilImage.farm_id == farm_id)

    images = query.order_by(SoilImage.uploaded_at.desc()).all()
    return [build_soil_image_response(img) for img in images]


@router.get("/{image_id}", response_model=SoilImageResponse)
def get_image(
    image_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get image metadata and latest analysis by ID. Checks ownership."""
    image = db.query(SoilImage).filter(
        SoilImage.id == image_id, SoilImage.user_id == current_user.id
    ).first()
    if not image:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image not found")
    return build_soil_image_response(image)


@router.get("/{image_id}/analysis", response_model=List[SoilAnalysisResponse])
def get_image_analyses(
    image_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve all persistent AI classification analyses for an image."""
    image = db.query(SoilImage).filter(
        SoilImage.id == image_id, SoilImage.user_id == current_user.id
    ).first()
    if not image:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image not found")

    analyses = db.query(SoilAnalysis).filter(
        SoilAnalysis.soil_image_id == image_id, SoilAnalysis.user_id == current_user.id
    ).order_by(SoilAnalysis.analyzed_at.desc()).all()

    return [build_analysis_response(a) for a in analyses]


@router.post("/{image_id}/classify", response_model=SoilAnalysisResponse)
def classify_stored_image(
    image_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Run or re-run MobileNetV3-Small AI classification on an already stored image
    and persist the result in PostgreSQL soil_analyses.
    """
    image = db.query(SoilImage).filter(
        SoilImage.id == image_id, SoilImage.user_id == current_user.id
    ).first()
    if not image:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image not found")

    if not os.path.exists(image.file_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Original image file not found on disk")

    if not classifier_service.is_loaded:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Soil classification model is not loaded.",
        )

    try:
        with Image.open(image.file_path) as pil_img:
            transposed = ImageOps.exif_transpose(pil_img)
            res = classifier_service.classify_image(transposed)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Could not read and classify image: {e}",
        )

    analysis = SoilAnalysis(
        soil_image_id=image.id,
        user_id=current_user.id,
        farm_id=image.farm_id,
        predicted_soil_type=res["predicted_soil"],
        confidence=res["confidence"],
        probabilities=res["probabilities"],
        model_name="MobileNetV3-Small",
        model_version="1.0.0",
        analysis_status="completed",
    )
    db.add(analysis)
    db.commit()
    db.refresh(analysis)
    return build_analysis_response(analysis)


@router.get("/{image_id}/file")
def get_image_file(
    image_id: int,
    current_user: User = Depends(get_user_from_header_or_query),
    db: Session = Depends(get_db),
):
    """Serve the original uploaded image file with header or query token auth."""
    image = db.query(SoilImage).filter(
        SoilImage.id == image_id, SoilImage.user_id == current_user.id
    ).first()
    if not image:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image not found")
    if not os.path.exists(image.file_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found on disk")
    return FileResponse(image.file_path, media_type=image.mime_type)


@router.get("/{image_id}/processed")
def get_processed_image(
    image_id: int,
    current_user: User = Depends(get_user_from_header_or_query),
    db: Session = Depends(get_db),
):
    """Serve the processed image file with header or query token auth."""
    image = db.query(SoilImage).filter(
        SoilImage.id == image_id, SoilImage.user_id == current_user.id
    ).first()
    if not image:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image not found")
    if not image.processed_path or not os.path.exists(image.processed_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Processed image not available")
    return FileResponse(image.processed_path, media_type=image.mime_type)


@router.post("/{image_id}/process", response_model=SoilImageResponse)
def process_image(
    image_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Apply OpenCV preprocessing to a soil image:
    1. Read with cv2.imread
    2. Resize to max 800x800 keeping aspect ratio
    3. Apply Gaussian blur to reduce noise
    4. Apply CLAHE (Contrast Limited Adaptive Histogram Equalization) on LAB color space
    5. Save processed image to backend/processed/farm_<farm_id>/
    6. Update DB record with processed_path
    """
    image = db.query(SoilImage).filter(
        SoilImage.id == image_id, SoilImage.user_id == current_user.id
    ).first()
    if not image:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image not found")

    if not os.path.exists(image.file_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Original file not found on disk")

    img = cv2.imread(image.file_path)
    if img is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Could not read image file",
        )

    # 1. Resize maintaining aspect ratio
    h, w = img.shape[:2]
    max_dim = 800
    if h > max_dim or w > max_dim:
        scale = max_dim / max(h, w)
        new_w = int(w * scale)
        new_h = int(h * scale)
        img = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)

    # 2. Gaussian blur for noise suppression
    blurred = cv2.GaussianBlur(img, (3, 3), 0)

    # 3. CLAHE Contrast & Texture enhancement in LAB color space
    lab = cv2.cvtColor(blurred, cv2.COLOR_BGR2LAB)
    l_channel, a_channel, b_channel = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    enhanced_l = clahe.apply(l_channel)
    enhanced_lab = cv2.merge((enhanced_l, a_channel, b_channel))
    processed_img = cv2.cvtColor(enhanced_lab, cv2.COLOR_LAB2BGR)

    # 4. Save to processed directory (farm-organized)
    if image.farm_id is not None:
        dest_proc_dir = os.path.join(PROCESSED_DIR, f"farm_{image.farm_id}")
    else:
        dest_proc_dir = os.path.join(PROCESSED_DIR, f"user_{current_user.id}")

    os.makedirs(dest_proc_dir, exist_ok=True)
    processed_filename = f"processed_{image.stored_filename}"
    processed_path = os.path.join(dest_proc_dir, processed_filename)
    cv2.imwrite(processed_path, processed_img)

    # 5. Update DB record with rollback protection
    try:
        image.processed_path = processed_path
        db.commit()
        db.refresh(image)
        return build_soil_image_response(image)
    except Exception:
        db.rollback()
        if os.path.exists(processed_path):
            try:
                os.remove(processed_path)
            except OSError:
                pass
        raise


@router.delete("/{image_id}", status_code=status.HTTP_200_OK)
def delete_image(
    image_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete an image record, its analyses, and its files from disk. Checks ownership."""
    image = db.query(SoilImage).filter(
        SoilImage.id == image_id, SoilImage.user_id == current_user.id
    ).first()
    if not image:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image not found")

    file_path = image.file_path
    processed_path = image.processed_path

    # Delete database record first (cascades to soil_analyses)
    db.delete(image)
    db.commit()

    # Clean up files from disk
    if file_path and os.path.exists(file_path):
        try:
            os.remove(file_path)
        except OSError:
            pass
    if processed_path and os.path.exists(processed_path):
        try:
            os.remove(processed_path)
        except OSError:
            pass

    return {"message": "Image deleted successfully"}
