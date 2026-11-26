import io
import os
import uuid
import pytest
from PIL import Image
import numpy as np
from fastapi.testclient import TestClient

from main import app
from auth import create_access_token
from soil_classifier import classifier_service

EXPECTED_CLASSES = [
    "Alluvial_Soil",
    "Arid_Soil",
    "Black_Soil",
    "Laterite_Soil",
    "Mountain_Soil",
    "Red_Soil",
    "Yellow_Soil",
]


def generate_test_image(format="JPEG", size=(300, 300), color=(110, 70, 45)):
    """Generate a valid test image byte stream."""
    buf = io.BytesIO()
    img = Image.new("RGB", size, color=color)
    img.save(buf, format=format)
    return buf.getvalue()


def test_soil_classifier_service_loaded():
    """Verify that the model loaded successfully and on the right device."""
    print("\n[1] Verifying Model Loading & Device Selection...")
    assert classifier_service.is_loaded is True, "Error: classifier_service failed to load!"
    assert classifier_service.model is not None, "Error: model is None!"
    assert classifier_service.num_classes == 7, f"Expected 7 classes, got {classifier_service.num_classes}"
    print(f" -> Compute Device: {classifier_service.device}")
    print(f" -> Classes: {classifier_service.class_names}")
    for c in EXPECTED_CLASSES:
        assert c in classifier_service.class_names, f"Missing expected class {c}"
    print(" -> Confirmed: Model is loaded and all 7 classes verified.")


def test_classify_valid_jpeg():
    """Test classification endpoint with a valid JPEG image."""
    print("\n[2] Testing POST /api/soil/classify-image with Valid JPEG...")
    client = TestClient(app)
    jpeg_bytes = generate_test_image("JPEG")

    res = client.post(
        "/api/soil/classify-image",
        files={"file": ("soil_sample.jpg", jpeg_bytes, "image/jpeg")},
    )
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    data = res.json()

    print(f" -> Predicted Soil: {data['predicted_soil']} ({data['predicted_soil_name']})")
    print(f" -> Confidence: {data['confidence']}%")
    assert data["predicted_soil"] in EXPECTED_CLASSES
    assert 0.0 <= data["confidence"] <= 100.0
    assert len(data["probabilities"]) == 7

    # Verify probability distribution
    prob_sum = sum(data["probabilities"].values())
    print(f" -> Sum of probabilities across 7 classes: {round(prob_sum, 2)}%")
    assert 99.0 <= prob_sum <= 101.0, f"Probability sum {prob_sum} is outside expected range"

    # Verify soil info & disclaimer
    assert "soil_info" in data and data["soil_info"] is not None
    assert "typical_crops" in data["soil_info"]
    assert "characteristics" in data["soil_info"]
    assert "disclaimer" in data and len(data["disclaimer"]) > 20
    print(" -> Confirmed: Valid JSON response with all probabilities, agronomic info, and ML disclaimer.")


def test_classify_valid_png():
    """Test classification endpoint with a valid PNG image."""
    print("\n[3] Testing POST /api/soil/classify-image with Valid PNG...")
    client = TestClient(app)
    png_bytes = generate_test_image("PNG", color=(180, 50, 40))

    res = client.post(
        "/api/soil/classify-image",
        files={"file": ("red_soil.png", png_bytes, "image/png")},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["predicted_soil"] in EXPECTED_CLASSES
    print(f" -> PNG classified successfully: {data['predicted_soil']} ({data['confidence']}%)")


def test_classify_with_jwt_auth():
    """Test classification endpoint with JWT Bearer token."""
    print("\n[4] Testing POST /api/soil/classify-image with Authenticated Farmer Token...")
    client = TestClient(app)
    token = create_access_token({"sub": "9", "email": "renanaik17@gmail.com"})
    jpeg_bytes = generate_test_image("JPEG")

    res = client.post(
        "/api/soil/classify-image",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("soil_auth.jpg", jpeg_bytes, "image/jpeg")},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["predicted_soil"] in EXPECTED_CLASSES
    print(" -> Confirmed: Authenticated request handled seamlessly.")


def test_classify_invalid_inputs():
    """Test robust error handling for invalid / corrupted uploads."""
    print("\n[5] Testing Validation & Error Handling (Invalid / Corrupted Inputs)...")
    client = TestClient(app)

    # 5a. Empty file
    res_empty = client.post(
        "/api/soil/classify-image",
        files={"file": ("empty.jpg", b"", "image/jpeg")},
    )
    assert res_empty.status_code == 422
    print(" -> Empty file rejected with 422 Unprocessable Entity.")

    # 5b. Non-image text disguised as jpg
    res_text = client.post(
        "/api/soil/classify-image",
        files={"file": ("fake.jpg", b"hello I am a text file", "image/jpeg")},
    )
    assert res_text.status_code == 422
    print(" -> Text file disguised as JPEG rejected with 422.")

    # 5c. Truncated / corrupted image
    corrupted = generate_test_image("JPEG")[:40]
    res_corrupt = client.post(
        "/api/soil/classify-image",
        files={"file": ("corrupt.jpg", corrupted, "image/jpeg")},
    )
    assert res_corrupt.status_code == 422
    print(" -> Corrupted / truncated JPEG rejected with 422.")

    # 5d. Disallowed file extension (e.g., .pdf)
    res_ext = client.post(
        "/api/soil/classify-image",
        files={"file": ("report.pdf", b"%PDF-1.4...", "application/pdf")},
    )
    assert res_ext.status_code == 422
    print(" -> Disallowed extension (.pdf) rejected with 422.")


if __name__ == "__main__":
    test_soil_classifier_service_loaded()
    test_classify_valid_jpeg()
    test_classify_valid_png()
    test_classify_with_jwt_auth()
    test_classify_invalid_inputs()
    print("\n==================================================================")
    print("ALL AI SOIL CLASSIFICATION INTEGRATION TESTS PASSED (100%)")
    print("==================================================================")
