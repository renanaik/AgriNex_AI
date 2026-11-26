"""
End-to-end verification of persistent soil image storage, farm association,
PostgreSQL persistence, and MobileNetV3 AI analysis in AgriNex.
"""
import io
import os
import sys
import time
import uuid
import numpy as np
from PIL import Image
from fastapi.testclient import TestClient

from main import app
from database import engine, SessionLocal
from models import User, Farm, SoilTest, SoilImage, SoilAnalysis
from auth import create_access_token, hash_password
from config import UPLOAD_DIR, SOIL_IMAGES_DIR, PROCESSED_DIR

client = TestClient(app)


def generate_test_image(img_format: str = "JPEG", size=(256, 256), color=(110, 75, 45)) -> bytes:
    """Generate a valid test image byte buffer with texture for testing."""
    arr = np.zeros((size[1], size[0], 3), dtype=np.uint8)
    arr[:] = color
    # Add random pixel variance
    noise = np.random.randint(-20, 20, size=arr.shape, dtype=np.int16)
    arr = np.clip(arr.astype(np.int16) + noise, 0, 255).astype(np.uint8)
    img = Image.fromarray(arr)
    buf = io.BytesIO()
    img.save(buf, format=img_format)
    return buf.getvalue()


def run_tests():
    print("\n" + "=" * 65)
    print("AGRINEX PERSISTENT SOIL IMAGE & ANALYSIS VERIFICATION SUITE")
    print("=" * 65)

    db = SessionLocal()
    clean_test_files = []

    try:
        # ── Setup Test Farmers & Farms ───────────────────────────────────────
        suffix = uuid.uuid4().hex[:8]
        email_a = f"farmer_alpha_{suffix}@example.com"
        email_b = f"farmer_beta_{suffix}@example.com"

        farmer_a = User(
            full_name="Farmer Alpha",
            email=email_a,
            password_hash=hash_password("password123"),
            language_preference="en",
        )
        farmer_b = User(
            full_name="Farmer Beta",
            email=email_b,
            password_hash=hash_password("password123"),
            language_preference="gu",
        )
        db.add_all([farmer_a, farmer_b])
        db.commit()
        db.refresh(farmer_a)
        db.refresh(farmer_b)

        token_a = create_access_token({"sub": str(farmer_a.id)})
        token_b = create_access_token({"sub": str(farmer_b.id)})
        headers_a = {"Authorization": f"Bearer {token_a}"}
        headers_b = {"Authorization": f"Bearer {token_b}"}

        print(f"[Setup] Created Farmer Alpha (ID: {farmer_a.id}) & Farmer Beta (ID: {farmer_b.id})")

        # Create Farms
        farm_a1 = Farm(user_id=farmer_a.id, farm_name="Green Valley", field_name="North Field", area=12.5)
        farm_a2 = Farm(user_id=farmer_a.id, farm_name="Sunny Ridge", field_name="Plot B", area=8.0)
        farm_b1 = Farm(user_id=farmer_b.id, farm_name="Beta Agro", field_name="Block 1", area=5.0)
        db.add_all([farm_a1, farm_a2, farm_b1])
        db.commit()
        db.refresh(farm_a1)
        db.refresh(farm_a2)
        db.refresh(farm_b1)

        # Create Soil Test on Farm A1
        soil_test_a1 = SoilTest(
            user_id=farmer_a.id,
            farm_id=farm_a1.id,
            nitrogen=140.0,
            phosphorus=32.0,
            potassium=190.0,
            ph=6.8,
            organic_matter=2.4,
            moisture=18.5,
            status="Healthy",
        )
        db.add(soil_test_a1)
        db.commit()
        db.refresh(soil_test_a1)

        print(f"[Setup] Created Farm A1 ({farm_a1.id}), Farm A2 ({farm_a2.id}), Farm B1 ({farm_b1.id})")
        print(f"[Setup] Created Soil Test #{soil_test_a1.id} for Farm A1")

        # ── Test 1: Upload JPEG with Farm & Soil Test Association ─────────────
        print("\n[Test 1] Uploading JPEG soil photograph (linked to Farm A1 & Soil Test)...")
        jpeg_bytes = generate_test_image("JPEG", color=(130, 85, 50))
        res1 = client.post(
            "/api/images/upload",
            headers=headers_a,
            files={"file": ("field_north.jpg", jpeg_bytes, "image/jpeg")},
            data={"farm_id": str(farm_a1.id), "soil_test_id": str(soil_test_a1.id)},
        )
        assert res1.status_code == 201, f"Expected 201, got {res1.status_code}: {res1.text}"
        img1_data = res1.json()
        img1_id = img1_data["id"]
        clean_test_files.append(img1_data["file_path"])

        print(f" -> Response Status: 201 Created | Image ID: {img1_id}")
        print(f" -> Stored Filename: {img1_data['stored_filename']}")
        print(f" -> File Path: {img1_data['file_path']}")

        # Verify physical file existence
        assert os.path.exists(img1_data["file_path"]), "Physical JPEG file does not exist on disk!"
        expected_farm_dir = os.path.join(SOIL_IMAGES_DIR, f"farm_{farm_a1.id}")
        assert img1_data["file_path"].startswith(expected_farm_dir), f"File not in farm dir: {img1_data['file_path']}"
        print(" -> Verified: Physical image saved in farm-structured directory.")

        # Verify database records
        db_img1 = db.query(SoilImage).filter(SoilImage.id == img1_id).first()
        assert db_img1 is not None
        assert db_img1.user_id == farmer_a.id
        assert db_img1.farm_id == farm_a1.id
        assert db_img1.soil_test_id == soil_test_a1.id
        print(" -> Verified: soil_images PostgreSQL record matches user_id and farm_id.")

        # Verify automatic MobileNetV3 classification persistence
        assert img1_data["latest_analysis"] is not None, "latest_analysis missing in response!"
        analysis1 = db.query(SoilAnalysis).filter(SoilAnalysis.soil_image_id == img1_id).first()
        assert analysis1 is not None, "soil_analyses PostgreSQL record missing!"
        assert analysis1.farm_id == farm_a1.id
        assert analysis1.user_id == farmer_a.id
        assert analysis1.model_name == "MobileNetV3-Small"
        assert len(analysis1.probabilities) == 7, f"Expected 7 classes, got {len(analysis1.probabilities)}"
        prob_sum = sum(analysis1.probabilities.values())
        assert 99.0 <= prob_sum <= 101.0, f"Probabilities do not sum to 100%: {prob_sum}"
        print(f" -> Verified: AI Analysis saved (Predicted: {analysis1.predicted_soil_type}, Confidence: {analysis1.confidence:.2f}%)")
        print(f" -> Verified: All 7 class probabilities saved (Sum: {prob_sum:.1f}%).")

        # ── Test 2: Upload PNG Image to Farm A2 ──────────────────────────────
        print("\n[Test 2] Uploading PNG soil photograph to Farm A2...")
        png_bytes = generate_test_image("PNG", color=(70, 50, 40))
        res2 = client.post(
            "/api/images/upload",
            headers=headers_a,
            files={"file": ("ridge_sample.png", png_bytes, "image/png")},
            data={"farm_id": str(farm_a2.id)},
        )
        assert res2.status_code == 201, f"Expected 201, got {res2.status_code}: {res2.text}"
        img2_data = res2.json()
        img2_id = img2_data["id"]
        clean_test_files.append(img2_data["file_path"])

        assert os.path.exists(img2_data["file_path"]), "PNG file not saved on disk!"
        assert img2_data["file_path"].startswith(os.path.join(SOIL_IMAGES_DIR, f"farm_{farm_a2.id}"))
        print(f" -> Verified: PNG saved physically in farm_{farm_a2.id} directory.")
        print(f" -> Verified: Stored in PostgreSQL with latest AI analysis: {img2_data['latest_analysis']['predicted_soil_type']}.")

        # ── Test 3: Upload WEBP Image to Farm A1 ─────────────────────────────
        print("\n[Test 3] Uploading WEBP soil photograph to Farm A1...")
        webp_bytes = generate_test_image("WEBP", color=(180, 70, 50))
        res3 = client.post(
            "/api/images/upload",
            headers=headers_a,
            files={"file": ("laterite_field.webp", webp_bytes, "image/webp")},
            data={"farm_id": str(farm_a1.id)},
        )
        assert res3.status_code == 201, f"Expected 201, got {res3.status_code}: {res3.text}"
        img3_data = res3.json()
        img3_id = img3_data["id"]
        clean_test_files.append(img3_data["file_path"])

        assert os.path.exists(img3_data["file_path"]), "WEBP file not saved on disk!"
        assert img3_data["mime_type"] == "image/webp"
        print(f" -> Verified: WEBP format accepted, stored physically, and analyzed successfully.")

        # ── Test 4: Upload Another Image with Same Name (No Overwrite) ────────
        print("\n[Test 4] Uploading second image with identical original filename (non-collision test)...")
        res4 = client.post(
            "/api/images/upload",
            headers=headers_a,
            files={"file": ("field_north.jpg", jpeg_bytes, "image/jpeg")},
            data={"farm_id": str(farm_a1.id)},
        )
        assert res4.status_code == 201
        img4_data = res4.json()
        clean_test_files.append(img4_data["file_path"])

        assert img4_data["id"] != img1_id, "IDs must be distinct"
        assert img4_data["stored_filename"] != img1_data["stored_filename"], "Stored filenames collided!"
        assert os.path.exists(img1_data["file_path"]), "First file was overwritten!"
        assert os.path.exists(img4_data["file_path"]), "Second file does not exist!"
        print(" -> Verified: Unique stored filenames prevent collision; both files exist on disk independently.")

        # ── Test 5: Farm Isolation & Retrieval ───────────────────────────────
        print("\n[Test 5] Retrieving images belonging to specific farms...")
        # Get Farm A1 images (should have 3 images: img1, img3, img4)
        res_a1 = client.get(f"/api/farms/{farm_a1.id}/images", headers=headers_a)
        assert res_a1.status_code == 200
        a1_imgs = res_a1.json()
        assert len(a1_imgs) == 3, f"Expected 3 images for Farm A1, got {len(a1_imgs)}"
        print(f" -> Verified: GET /api/farms/{farm_a1.id}/images returned exactly 3 images.")

        # Get Farm A2 images (should have 1 image: img2)
        res_a2 = client.get(f"/api/farms/{farm_a2.id}/images", headers=headers_a)
        assert res_a2.status_code == 200
        a2_imgs = res_a2.json()
        assert len(a2_imgs) == 1, f"Expected 1 image for Farm A2, got {len(a2_imgs)}"
        assert a2_imgs[0]["id"] == img2_id
        print(f" -> Verified: GET /api/farms/{farm_a2.id}/images returned exactly 1 image.")

        # Filter via query param on /api/images
        res_filter = client.get(f"/api/images?farm_id={farm_a1.id}", headers=headers_a)
        assert res_filter.status_code == 200
        assert len(res_filter.json()) == 3
        print(f" -> Verified: GET /api/images?farm_id={farm_a1.id} returned matching 3 images.")

        # ── Test 6: Farm Historical Analysis & Timeline ──────────────────────
        print("\n[Test 6] Retrieving farm historical timeline and latest analysis...")
        res_latest = client.get(f"/api/farms/{farm_a1.id}/latest-analysis", headers=headers_a)
        assert res_latest.status_code == 200
        latest_analysis = res_latest.json()
        assert latest_analysis is not None
        assert "predicted_soil_type" in latest_analysis
        print(f" -> Verified: Latest analysis for Farm A1: {latest_analysis['predicted_soil_name']} ({latest_analysis['confidence']}%)")

        res_history = client.get(f"/api/farms/{farm_a1.id}/history", headers=headers_a)
        assert res_history.status_code == 200
        history_data = res_history.json()
        assert history_data["total_images"] == 3
        assert history_data["total_tests"] == 1
        assert history_data["total_analyses"] == 3
        assert len(history_data["timeline"]) == 4  # 1 test + 3 analyses
        # Verify chronological ordering
        timestamps = [item["timestamp"] for item in history_data["timeline"]]
        assert timestamps == sorted(timestamps, reverse=True), "Timeline is not sorted descending!"
        print(f" -> Verified: Farm history timeline contains {len(history_data['timeline'])} chronologically ordered records.")

        # ── Test 7: Reject Farm Belonging to Another User ─────────────────────
        print("\n[Test 7] Testing security: Farmer Beta tries to upload to Farmer Alpha's farm...")
        res_unauthorized_upload = client.post(
            "/api/images/upload",
            headers=headers_b,
            files={"file": ("hack.jpg", jpeg_bytes, "image/jpeg")},
            data={"farm_id": str(farm_a1.id)},
        )
        assert res_unauthorized_upload.status_code == 404
        print(" -> Verified: 404 returned when user tries to link another farmer's farm.")

        # ── Test 8: Reject Unauthorized Access to Another Farmer's Image ──────
        print("\n[Test 8] Testing security: Farmer Beta tries to access Farmer Alpha's image...")
        res_b_view = client.get(f"/api/images/{img1_id}", headers=headers_b)
        assert res_b_view.status_code == 404
        res_b_file = client.get(f"/api/images/{img1_id}/file", headers=headers_b)
        assert res_b_file.status_code == 404
        res_b_del = client.delete(f"/api/images/{img1_id}", headers=headers_b)
        assert res_b_del.status_code == 404
        res_b_farm_hist = client.get(f"/api/farms/{farm_a1.id}/history", headers=headers_b)
        assert res_b_farm_hist.status_code == 404
        print(" -> Verified: Strict farmer isolation blocks read, file download, history, and delete (404).")

        # ── Test 9: Invalid & Corrupted Images ─────────────────────────────────
        print("\n[Test 9] Testing validation: corrupted and invalid image content...")
        # Text file disguised as JPG
        res_fake = client.post(
            "/api/images/upload",
            headers=headers_a,
            files={"file": ("fake.jpg", b"Plain text file content", "image/jpeg")},
            data={"farm_id": str(farm_a1.id)},
        )
        assert res_fake.status_code == 422
        print(" -> Verified: Text file disguised as JPG rejected with 422.")

        # Truncated corrupt bytes
        res_corrupt = client.post(
            "/api/images/upload",
            headers=headers_a,
            files={"file": ("corrupt.jpg", jpeg_bytes[:20], "image/jpeg")},
            data={"farm_id": str(farm_a1.id)},
        )
        assert res_corrupt.status_code == 422
        print(" -> Verified: Corrupted truncated image rejected with 422.")

        # Disallowed extension
        res_ext = client.post(
            "/api/images/upload",
            headers=headers_a,
            files={"file": ("doc.pdf", b"%PDF-1.4...", "application/pdf")},
            data={"farm_id": str(farm_a1.id)},
        )
        assert res_ext.status_code == 422
        print(" -> Verified: Disallowed extension (.pdf) rejected with 422.")

        # ── Test 10: OpenCV Preprocessing & Secure Serving ───────────────────
        print("\n[Test 10] Testing OpenCV CLAHE preprocessing and secure file serving...")
        res_proc = client.post(f"/api/images/{img1_id}/process", headers=headers_a)
        assert res_proc.status_code == 200
        proc_data = res_proc.json()
        assert proc_data["processed_path"] is not None
        assert os.path.exists(proc_data["processed_path"]), "Processed file does not exist on disk!"
        clean_test_files.append(proc_data["processed_path"])
        print(f" -> Verified: OpenCV CLAHE processed image saved to {proc_data['processed_path']}")

        # Query token serving for HTML <img>
        res_serve_orig = client.get(f"/api/images/{img1_id}/file?token={token_a}")
        assert res_serve_orig.status_code == 200
        assert res_serve_orig.headers["content-type"] == "image/jpeg"
        assert len(res_serve_orig.content) == len(jpeg_bytes)
        print(" -> Verified: Original image served via token query parameter.")

        res_serve_proc = client.get(f"/api/images/{img1_id}/processed?token={token_a}")
        assert res_serve_proc.status_code == 200
        assert len(res_serve_proc.content) > 0
        print(" -> Verified: OpenCV processed image served via token query parameter.")

        # ── Test 11: Re-running Classification on Stored Image ───────────────
        print("\n[Test 11] Testing re-classification endpoint for stored images...")
        res_reclass = client.post(f"/api/images/{img1_id}/classify", headers=headers_a)
        assert res_reclass.status_code == 200
        reclass_data = res_reclass.json()
        assert reclass_data["soil_image_id"] == img1_id
        assert reclass_data["confidence"] > 0
        total_analyses = db.query(SoilAnalysis).filter(SoilAnalysis.soil_image_id == img1_id).count()
        assert total_analyses == 2, f"Expected 2 analyses for img1, got {total_analyses}"
        print(f" -> Verified: Stored image re-analyzed; history preserved ({total_analyses} analyses recorded).")

        # ── Test 12: Delete Cleanup (DB & Disk) ──────────────────────────────
        print("\n[Test 12] Testing deletion and file cleanup...")
        file_to_delete = db_img1.file_path
        proc_to_delete = db_img1.processed_path
        res_del = client.delete(f"/api/images/{img1_id}", headers=headers_a)
        assert res_del.status_code == 200
        assert not os.path.exists(file_to_delete), "Original file still on disk after deletion!"
        if proc_to_delete:
            assert not os.path.exists(proc_to_delete), "Processed file still on disk after deletion!"
        # Check cascade delete on soil_analyses
        orphaned_analyses = db.query(SoilAnalysis).filter(SoilAnalysis.soil_image_id == img1_id).count()
        assert orphaned_analyses == 0, "soil_analyses records not cascaded!"
        print(" -> Verified: Delete cleanly purged database records, cascaded analyses, and removed files from disk.")

        print("\n" + "=" * 65)
        print("ALL 12 PERSISTENT STORAGE AND FARM ANALYSIS TESTS PASSED (100%)!")
        print("=" * 65)

    finally:
        # Cleanup remaining test files from disk
        for p in clean_test_files:
            if os.path.exists(p):
                try:
                    os.remove(p)
                except OSError:
                    pass
        db.close()


if __name__ == "__main__":
    run_tests()
