import os
import io
import time
import uuid
import cv2
import numpy as np
from PIL import Image
from fastapi.testclient import TestClient
from main import app
from database import engine, Base, SessionLocal
from config import UPLOAD_DIR, PROCESSED_DIR
import models

def generate_test_image(format_ext="JPEG", color=(45, 82, 130)):
    """Generate a valid test image byte stream using Pillow & OpenCV."""
    img_array = np.zeros((300, 300, 3), dtype=np.uint8)
    img_array[:] = color
    cv2.putText(
        img_array,
        f"Soil {format_ext}",
        (30, 150),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.8,
        (255, 255, 255),
        2,
    )
    buf = io.BytesIO()
    pil_img = Image.fromarray(cv2.cvtColor(img_array, cv2.COLOR_BGR2RGB))
    pil_img.save(buf, format=format_ext)
    return buf.getvalue()

def run_tests():
    print("==================================================")
    print("RUNNING AGRI-NEX POSTGRESQL & API INTEGRATION TESTS")
    print("==================================================")

    # 1. Verify PostgreSQL Database Engine
    print("\n[1] Verifying Database Connection...")
    dialect_name = engine.dialect.name
    print(f" -> Database dialect: {dialect_name}")
    assert dialect_name == "postgresql", f"Expected PostgreSQL, but found {dialect_name}!"
    print(" -> CONFIRMED: Backend is connected to PostgreSQL (not SQLite).")

    # Ensure tables exist
    Base.metadata.create_all(bind=engine)

    test_uid = uuid.uuid4().hex[:8]
    email_a = f"farmer_a_{test_uid}@example.com"
    email_b = f"farmer_b_{test_uid}@example.com"

    created_user_ids = []

    with TestClient(app) as client:
        try:
            # 2. Signup Farmer A
            print(f"\n[2] Testing Farmer A Signup ({email_a})...")
            res_signup_a = client.post("/api/auth/signup", json={
                "full_name": "Ramesh Patel",
                "email": email_a,
                "phone": "+91 9876543210",
                "password": "Password123!",
                "language_preference": "gu"
            })
            assert res_signup_a.status_code == 201, f"Signup failed: {res_signup_a.text}"
            data_a = res_signup_a.json()
            token_a = data_a["token"]
            user_a_id = data_a["user"]["id"]
            created_user_ids.append(user_a_id)
            headers_a = {"Authorization": f"Bearer {token_a}"}
            print(f" -> Farmer A created (ID: {user_a_id}).")

            # 3. Duplicate Email Rejection
            print("\n[3] Testing Duplicate Email Check...")
            res_dup = client.post("/api/auth/signup", json={
                "full_name": "Duplicate Ramesh",
                "email": email_a,
                "password": "Password123!"
            })
            assert res_dup.status_code == 409
            print(" -> Correctly blocked duplicate email with 409 Conflict.")

            # 4. Login Farmer A
            print("\n[4] Testing Farmer A Login...")
            res_login = client.post("/api/auth/login", json={
                "email": email_a,
                "password": "Password123!"
            })
            assert res_login.status_code == 200
            assert "token" in res_login.json()
            print(" -> Login successful with JWT.")

            # 5. Create Farms for Farmer A
            print("\n[5] Testing Farm Creation for Farmer A...")
            res_farm1 = client.post("/api/farms/", headers=headers_a, json={
                "farm_name": "Patel Organic Farms",
                "field_name": "North Field #1",
                "location": "Anand, Gujarat",
                "area": 12.5,
                "soil_type": "Loamy"
            })
            assert res_farm1.status_code == 201
            farm1_id = res_farm1.json()["id"]

            res_farm2 = client.post("/api/farms/", headers=headers_a, json={
                "farm_name": "Patel Organic Farms",
                "field_name": "South Field #2",
                "location": "Anand, Gujarat",
                "area": 8.0,
                "soil_type": "Clay"
            })
            assert res_farm2.status_code == 201
            farm2_id = res_farm2.json()["id"]
            print(f" -> Created Farm 1 (ID: {farm1_id}) and Farm 2 (ID: {farm2_id}).")

            # 6. Create Soil Tests for Farmer A
            print("\n[6] Testing Soil Test Submission...")
            res_test1 = client.post("/api/soil-tests/", headers=headers_a, json={
                "farm_id": farm1_id,
                "nitrogen": 140.0,
                "phosphorus": 45.0,
                "potassium": 210.0,
                "ph": 6.8,
                "organic_matter": 3.5,
                "moisture": 22.0,
                "notes": "Good loamy soil conditions"
            })
            assert res_test1.status_code == 201
            test1_id = res_test1.json()["id"]

            res_test2 = client.post("/api/soil-tests/", headers=headers_a, json={
                "farm_id": farm2_id,
                "nitrogen": 40.0,
                "phosphorus": 15.0,
                "potassium": 80.0,
                "ph": 4.8,
                "notes": "Critical nitrogen deficiency"
            })
            assert res_test2.status_code == 201
            test2_id = res_test2.json()["id"]
            print(f" -> Created Soil Test 1 on Farm 1 (ID: {test1_id}) and Soil Test 2 on Farm 2 (ID: {test2_id}).")

            # 7. Signup Farmer B
            print(f"\n[7] Testing Farmer B Signup ({email_b})...")
            res_signup_b = client.post("/api/auth/signup", json={
                "full_name": "Suresh Sharma",
                "email": email_b,
                "phone": "+91 9123456789",
                "password": "Password456!",
                "language_preference": "en"
            })
            assert res_signup_b.status_code == 201
            token_b = res_signup_b.json()["token"]
            user_b_id = res_signup_b.json()["user"]["id"]
            created_user_ids.append(user_b_id)
            headers_b = {"Authorization": f"Bearer {token_b}"}
            print(f" -> Farmer B created (ID: {user_b_id}).")

            # 8. Test Image Upload Ownership Checks (Security)
            print("\n[8] Testing Image Upload Ownership Validation...")
            valid_jpg = generate_test_image("JPEG")

            # 8a. Farmer A tries to link Farmer B's non-existent farm -> 404
            res_bad_farm = client.post(
                "/api/images/upload",
                headers=headers_a,
                files={"file": ("soil.jpg", valid_jpg, "image/jpeg")},
                data={"farm_id": "999999"}
            )
            assert res_bad_farm.status_code == 404, f"Expected 404, got {res_bad_farm.status_code}"
            print(" -> 404 correctly returned when farm_id is not owned by user.")

            # 8b. Farmer A tries to link non-existent soil_test_id -> 404
            res_bad_test = client.post(
                "/api/images/upload",
                headers=headers_a,
                files={"file": ("soil.jpg", valid_jpg, "image/jpeg")},
                data={"soil_test_id": "999999"}
            )
            assert res_bad_test.status_code == 404
            print(" -> 404 correctly returned when soil_test_id is not owned by user.")

            # 8c. Farmer B tries to upload an image linking Farmer A's farm -> 404
            res_b_a_farm = client.post(
                "/api/images/upload",
                headers=headers_b,
                files={"file": ("soil.jpg", valid_jpg, "image/jpeg")},
                data={"farm_id": str(farm1_id)}
            )
            assert res_b_a_farm.status_code == 404
            print(" -> 404 correctly returned when Farmer B tries to use Farmer A's farm_id.")

            # 8d. Farmer A passes farm_id=farm2_id, but test1 belongs to farm1 -> 400 Bad Request
            res_mismatch = client.post(
                "/api/images/upload",
                headers=headers_a,
                files={"file": ("soil.jpg", valid_jpg, "image/jpeg")},
                data={"farm_id": str(farm2_id), "soil_test_id": str(test1_id)}
            )
            assert res_mismatch.status_code == 400
            assert "does not belong" in res_mismatch.json()["detail"].lower()
            print(" -> 400 correctly returned when soil_test does not belong to selected farm.")

            # 9. Test Image Content Validation
            print("\n[9] Testing Image Content Validation (Corrupted & Invalid Types)...")

            # Count files in upload dir before tests
            files_before = set(os.listdir(UPLOAD_DIR)) if os.path.exists(UPLOAD_DIR) else set()

            # 9a. Fake JPEG (Text file pretending to be .jpg)
            fake_img = b"This is a text file, not a real image."
            res_fake = client.post(
                "/api/images/upload",
                headers=headers_a,
                files={"file": ("fake.jpg", fake_img, "image/jpeg")}
            )
            assert res_fake.status_code == 422, f"Expected 422 for fake image, got {res_fake.status_code}"
            print(" -> 422 correctly returned for text file disguised as JPEG.")

            # 9b. Corrupted JPEG (Truncated bytes)
            corrupted_jpg = valid_jpg[:50]
            res_corrupt = client.post(
                "/api/images/upload",
                headers=headers_a,
                files={"file": ("corrupt.jpg", corrupted_jpg, "image/jpeg")}
            )
            assert res_corrupt.status_code == 422
            print(" -> 422 correctly returned for truncated / corrupted JPEG content.")

            # 9c. Unsupported image format (GIF format disguised as PNG)
            buf_gif = io.BytesIO()
            Image.new("RGB", (50, 50), color="green").save(buf_gif, format="GIF")
            gif_bytes = buf_gif.getvalue()
            res_gif = client.post(
                "/api/images/upload",
                headers=headers_a,
                files={"file": ("test.png", gif_bytes, "image/png")}
            )
            assert res_gif.status_code == 422
            print(" -> 422 correctly returned when actual content is not JPEG or PNG.")

            # 9d. Verify no orphaned files created by failed uploads
            files_after = set(os.listdir(UPLOAD_DIR)) if os.path.exists(UPLOAD_DIR) else set()
            new_files = files_after - files_before
            assert len(new_files) == 0, f"Found orphaned files left on disk: {new_files}"
            print(" -> CONFIRMED: No orphaned files left on disk after failed upload validations.")

            # 10. Test Valid Image Uploads (JPEG and PNG)
            print("\n[10] Testing Valid Image Uploads & Database Consistency...")

            # 10a. Valid JPEG linked to Farm 1 and Test 1
            res_valid_jpg = client.post(
                "/api/images/upload",
                headers=headers_a,
                files={"file": ("valid_soil.jpg", valid_jpg, "image/jpeg")},
                data={"farm_id": str(farm1_id), "soil_test_id": str(test1_id)}
            )
            assert res_valid_jpg.status_code == 201
            img_jpg_id = res_valid_jpg.json()["id"]
            print(f" -> Valid JPEG uploaded successfully (ID: {img_jpg_id}).")

            # 10b. Valid PNG linked to Farm 2
            valid_png = generate_test_image("PNG", color=(80, 110, 50))
            res_valid_png = client.post(
                "/api/images/upload",
                headers=headers_a,
                files={"file": ("valid_soil.png", valid_png, "image/png")},
                data={"farm_id": str(farm2_id)}
            )
            assert res_valid_png.status_code == 201
            img_png_id = res_valid_png.json()["id"]
            print(f" -> Valid PNG uploaded successfully (ID: {img_png_id}).")

            # 11. Test OpenCV Processing & File Serving
            print("\n[11] Testing OpenCV CLAHE Processing...")
            res_proc = client.post(f"/api/images/{img_jpg_id}/process", headers=headers_a)
            assert res_proc.status_code == 200
            proc_path = res_proc.json()["processed_path"]
            assert proc_path is not None and os.path.exists(proc_path)
            print(" -> OpenCV CLAHE preprocessing completed and verified on disk.")

            # File serving with token parameter
            res_file = client.get(f"/api/images/{img_jpg_id}/file?token={token_a}")
            assert res_file.status_code == 200
            res_proc_file = client.get(f"/api/images/{img_jpg_id}/processed?token={token_a}")
            assert res_proc_file.status_code == 200
            print(" -> File serving with query token verified.")

            # 12. Strict Farmer Data Isolation for Images
            print("\n[12] Testing Image Access Isolation...")
            res_b_img = client.get(f"/api/images/{img_jpg_id}", headers=headers_b)
            assert res_b_img.status_code == 404
            res_b_proc = client.post(f"/api/images/{img_jpg_id}/process", headers=headers_b)
            assert res_b_proc.status_code == 404
            res_b_del = client.delete(f"/api/images/{img_jpg_id}", headers=headers_b)
            assert res_b_del.status_code == 404
            print(" -> Farmer B blocked with 404 from viewing, processing, or deleting Farmer A's image.")

            # 13. Testing Live Camera Captured Photo Upload & OpenCV Processing
            print("\n[13] Testing Live Camera Captured Photo Upload & Processing...")
            # Simulate camera-captured soil photo from canvas.toBlob()
            camera_filename = f"soil_capture_{int(time.time())}.jpg"
            camera_photo_bytes = generate_test_image("JPEG", color=(60, 45, 30)) # soil brown color

            res_camera_upload = client.post(
                "/api/images/upload",
                headers=headers_a,
                files={"file": (camera_filename, camera_photo_bytes, "image/jpeg")},
                data={"farm_id": str(farm1_id)}
            )
            assert res_camera_upload.status_code == 201, f"Camera upload failed: {res_camera_upload.text}"
            camera_img_data = res_camera_upload.json()
            camera_img_id = camera_img_data["id"]
            assert camera_img_data["original_filename"] == camera_filename
            assert camera_img_data["farm_id"] == farm1_id
            print(f" -> Camera-captured photo uploaded successfully (ID: {camera_img_id}, Name: {camera_filename}).")

            # Check image records in gallery
            res_gallery = client.get("/api/images", headers=headers_a)
            assert res_gallery.status_code == 200
            gallery_items = res_gallery.json()
            assert any(item["id"] == camera_img_id for item in gallery_items)
            print(" -> Camera capture confirmed present in farmer's image records/gallery.")

            # Run OpenCV CLAHE preprocessing on captured image
            res_camera_proc = client.post(f"/api/images/{camera_img_id}/process", headers=headers_a)
            assert res_camera_proc.status_code == 200
            camera_proc_path = res_camera_proc.json()["processed_path"]
            assert camera_proc_path is not None and os.path.exists(camera_proc_path)
            print(" -> OpenCV CLAHE preprocessing succeeded on live camera captured photo.")

            # Verify file serving for captured image (both raw and processed)
            res_cam_raw = client.get(f"/api/images/{camera_img_id}/file?token={token_a}")
            assert res_cam_raw.status_code == 200
            assert len(res_cam_raw.content) > 0

            res_cam_proc = client.get(f"/api/images/{camera_img_id}/processed?token={token_a}")
            assert res_cam_proc.status_code == 200
            assert len(res_cam_proc.content) > 0
            print(" -> Live camera captured photo served securely with token.")

            print("\n==================================================")
            print("ALL INTEGRATION & POSTGRESQL TESTS PASSED!")
            print("==================================================")

        finally:
            # Cleanup test records from PostgreSQL so tests are repeatable
            db = SessionLocal()
            try:
                for uid in created_user_ids:
                    u = db.query(models.User).filter(models.User.id == uid).first()
                    if u:
                        db.delete(u)
                db.commit()
            except Exception as e:
                db.rollback()
                print(f"Cleanup note: {e}")
            finally:
                db.close()

if __name__ == "__main__":
    run_tests()
