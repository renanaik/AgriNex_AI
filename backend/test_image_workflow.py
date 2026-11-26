import os
import io
import uuid
import time
import cv2
import numpy as np
from PIL import Image
from fastapi.testclient import TestClient

from main import app
from database import engine, SessionLocal
from models import User, Farm, SoilTest, SoilImage
from config import UPLOAD_DIR, PROCESSED_DIR
from auth import create_access_token

def generate_sample_image(format_ext="JPEG", color=(90, 60, 40)):
    """Generate a realistic test soil patch."""
    img_array = np.zeros((400, 400, 3), dtype=np.uint8)
    img_array[:] = color
    # Add soil-like texture noise
    noise = np.random.randint(0, 30, (400, 400, 3), dtype=np.uint8)
    img_array = cv2.add(img_array, noise)
    cv2.putText(
        img_array,
        f"AgriNex Soil {format_ext}",
        (30, 200),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.8,
        (255, 255, 255),
        2,
    )
    buf = io.BytesIO()
    pil_img = Image.fromarray(cv2.cvtColor(img_array, cv2.COLOR_BGR2RGB))
    pil_img.save(buf, format=format_ext)
    return buf.getvalue()

def test_full_image_workflow():
    print("==================================================================")
    print("VERIFYING POSTGRESQL & IMAGE WORKFLOW INTEGRATION END-TO-END")
    print("==================================================================")

    # 1. Check PostgreSQL dialect & schema
    print("\n[A] Checking PostgreSQL Database Connection & Schema...")
    assert engine.dialect.name == "postgresql", f"Error: engine dialect is {engine.dialect.name}, expected postgresql"
    print(" -> Confirmed: Database dialect is PostgreSQL.")

    db = SessionLocal()
    client = TestClient(app)

    test_uid = uuid.uuid4().hex[:6]
    test_email_a = f"test_farmer_a_{test_uid}@agrinex.org"
    test_email_b = f"test_farmer_b_{test_uid}@agrinex.org"

    created_image_ids = []
    user_a = None
    user_b = None

    try:
        # Create test farmers
        user_a = User(
            full_name=f"Test Farmer A {test_uid}",
            email=test_email_a,
            password_hash="mock_hash_for_test",
            language_preference="en",
        )
        user_b = User(
            full_name=f"Test Farmer B {test_uid}",
            email=test_email_b,
            password_hash="mock_hash_for_test",
            language_preference="en",
        )
        db.add_all([user_a, user_b])
        db.commit()
        db.refresh(user_a)
        db.refresh(user_b)

        # Create a farm and soil test for Farmer A
        farm_a = Farm(
            user_id=user_a.id,
            farm_name="Green Acres",
            field_name="North Field",
            soil_type="Loamy",
        )
        db.add(farm_a)
        db.commit()
        db.refresh(farm_a)

        test_a = SoilTest(
            user_id=user_a.id,
            farm_id=farm_a.id,
            nitrogen=130.0,
            phosphorus=42.0,
            potassium=190.0,
            ph=6.8,
            organic_matter=3.2,
            moisture=28.0,
            status="Healthy",
        )
        db.add(test_a)
        db.commit()
        db.refresh(test_a)

        token_a = create_access_token(data={"sub": str(user_a.id), "email": user_a.email})
        token_b = create_access_token(data={"sub": str(user_b.id), "email": user_b.email})
        headers_a = {"Authorization": f"Bearer {token_a}"}
        headers_b = {"Authorization": f"Bearer {token_b}"}

        print(f" -> Farmer A created: ID={user_a.id}, Farm ID={farm_a.id}, Soil Test ID={test_a.id}")
        print(f" -> Farmer B created: ID={user_b.id}")

        # 2. Upload actual JPEG soil image for Farmer A
        print("\n[B] Testing Image Upload (JPEG with Farm & Soil Test Association)...")
        jpeg_bytes = generate_sample_image("JPEG")
        upload_res = client.post(
            "/api/images/upload",
            headers=headers_a,
            files={"file": ("soil_north_field.jpg", jpeg_bytes, "image/jpeg")},
            data={"farm_id": str(farm_a.id), "soil_test_id": str(test_a.id)},
        )
        assert upload_res.status_code == 201, f"Upload failed: {upload_res.text}"
        img_data = upload_res.json()
        img_id = img_data["id"]
        created_image_ids.append(img_id)

        print(f" -> Upload API response status: 201 Created")
        print(f" -> Image ID: {img_id}")
        print(f" -> Original filename: {img_data['original_filename']}")
        print(f" -> Stored filename: {img_data['stored_filename']}")
        print(f" -> File size: {img_data['file_size']} bytes")
        print(f" -> Farm ID linked: {img_data['farm_id']}")
        print(f" -> Soil Test ID linked: {img_data['soil_test_id']}")

        # 3. Verify PostgreSQL database record insertion
        print("\n[C] Verifying Record in PostgreSQL 'soil_images' Table...")
        db_img = db.query(SoilImage).filter(SoilImage.id == img_id).first()
        assert db_img is not None, "Error: Record not found in PostgreSQL!"
        assert db_img.user_id == user_a.id, f"user_id mismatch: {db_img.user_id} != {user_a.id}"
        assert db_img.farm_id == farm_a.id, f"farm_id mismatch: {db_img.farm_id} != {farm_a.id}"
        assert db_img.soil_test_id == test_a.id, f"soil_test_id mismatch: {db_img.soil_test_id} != {test_a.id}"
        assert db_img.mime_type == "image/jpeg"
        assert db_img.file_size == len(jpeg_bytes)
        print(" -> Confirmed: Record correctly inserted into PostgreSQL with all foreign keys & metadata.")

        # 4. Verify physical file storage on disk
        print("\n[D] Verifying Physical File on Disk...")
        physical_path = db_img.file_path
        print(f" -> Physical path in DB: {physical_path}")
        assert os.path.exists(physical_path), f"Error: File does not exist on disk at {physical_path}!"
        disk_size = os.path.getsize(physical_path)
        assert disk_size == len(jpeg_bytes), f"Disk size {disk_size} != uploaded size {len(jpeg_bytes)}"
        print(f" -> Confirmed: Physical file exists on server ({disk_size} bytes).")

        # 5. Verify image retrieval through API (list and individual file)
        print("\n[E] Verifying Image Retrieval & File Serving...")
        list_res = client.get("/api/images/", headers=headers_a)
        assert list_res.status_code == 200
        user_images = list_res.json()
        assert any(i["id"] == img_id for i in user_images), "Uploaded image missing from /api/images/"
        print(f" -> Confirmed: Image appears in Farmer A's image list ({len(user_images)} total).")

        # Serve raw file with Bearer header
        file_res_hdr = client.get(f"/api/images/{img_id}/file", headers=headers_a)
        assert file_res_hdr.status_code == 200
        assert file_res_hdr.content == jpeg_bytes
        print(" -> Confirmed: Original file served via Authorization header.")

        # Serve raw file with ?token= query parameter (for standard <img> tags)
        file_res_query = client.get(f"/api/images/{img_id}/file?token={token_a}")
        assert file_res_query.status_code == 200
        assert file_res_query.content == jpeg_bytes
        print(" -> Confirmed: Original file served via ?token= query parameter.")

        # 6. Verify OpenCV CLAHE preprocessing
        print("\n[F] Testing OpenCV Image Preprocessing & Processed Storage...")
        proc_res = client.post(f"/api/images/{img_id}/process", headers=headers_a)
        assert proc_res.status_code == 200, f"Processing failed: {proc_res.text}"
        proc_data = proc_res.json()
        proc_path = proc_data["processed_path"]
        assert proc_path is not None, "processed_path is None!"
        assert os.path.exists(proc_path), f"Processed file does not exist at {proc_path}!"
        print(f" -> Processed image created on disk: {proc_path}")

        # Check DB updated
        db.refresh(db_img)
        assert db_img.processed_path == proc_path, "DB processed_path not updated!"
        print(" -> Confirmed: PostgreSQL updated with processed_path.")

        # Serve processed image
        proc_file_res = client.get(f"/api/images/{img_id}/processed?token={token_a}")
        assert proc_file_res.status_code == 200
        assert len(proc_file_res.content) > 0
        print(f" -> Confirmed: Processed image served ({len(proc_file_res.content)} bytes).")

        # 7. Verify strict farmer-wise ownership isolation
        print("\n[G] Testing Access Restrictions & Ownership Isolation...")
        # Farmer B tries to list images
        b_list = client.get("/api/images/", headers=headers_b).json()
        assert not any(i["id"] == img_id for i in b_list), "Security issue: Farmer B sees Farmer A's image in list!"
        print(" -> Confirmed: Farmer B's gallery does not contain Farmer A's image.")

        # Farmer B tries to view Farmer A's image metadata
        b_meta = client.get(f"/api/images/{img_id}", headers=headers_b)
        assert b_meta.status_code == 404, f"Expected 404, got {b_meta.status_code}"
        print(" -> Confirmed: Farmer B blocked (404) from image metadata.")

        # Farmer B tries to download Farmer A's original file
        b_file = client.get(f"/api/images/{img_id}/file?token={token_b}")
        assert b_file.status_code == 404, f"Expected 404, got {b_file.status_code}"
        print(" -> Confirmed: Farmer B blocked (404) from original file.")

        # Farmer B tries to download Farmer A's processed file
        b_proc = client.get(f"/api/images/{img_id}/processed?token={token_b}")
        assert b_proc.status_code == 404, f"Expected 404, got {b_proc.status_code}"
        print(" -> Confirmed: Farmer B blocked (404) from processed file.")

        # Farmer B tries to process Farmer A's image
        b_trigger = client.post(f"/api/images/{img_id}/process", headers=headers_b)
        assert b_trigger.status_code == 404
        print(" -> Confirmed: Farmer B blocked (404) from running OpenCV processing.")

        # Farmer B tries to delete Farmer A's image
        b_del = client.delete(f"/api/images/{img_id}", headers=headers_b)
        assert b_del.status_code == 404
        print(" -> Confirmed: Farmer B blocked (404) from deleting Farmer A's image.")

        # Farmer B tries to upload using Farmer A's farm_id
        b_inject = client.post(
            "/api/images/upload",
            headers=headers_b,
            files={"file": ("hack.jpg", jpeg_bytes, "image/jpeg")},
            data={"farm_id": str(farm_a.id)},
        )
        assert b_inject.status_code == 404
        print(" -> Confirmed: Farmer B blocked (404) from linking to Farmer A's farm.")

        # 8. Test delete workflow
        print("\n[H] Testing Image Deletion & Physical Cleanup...")
        del_res = client.delete(f"/api/images/{img_id}", headers=headers_a)
        assert del_res.status_code == 200
        print(" -> Delete endpoint returned 200 OK.")

        # Confirm deleted from PostgreSQL
        assert db.query(SoilImage).filter(SoilImage.id == img_id).first() is None
        print(" -> Confirmed: Record deleted from PostgreSQL.")

        # Confirm physical files removed
        assert not os.path.exists(physical_path), f"File still on disk: {physical_path}"
        assert not os.path.exists(proc_path), f"Processed file still on disk: {proc_path}"
        print(" -> Confirmed: Physical files cleanly removed from disk.")
        created_image_ids.clear()

        print("\n==================================================================")
        print("ALL POSTGRESQL & IMAGE WORKFLOW INTEGRATION TESTS PASSED (100%)")
        print("==================================================================")

    finally:
        # Cleanup test files if any were left
        for i_id in created_image_ids:
            rec = db.query(SoilImage).filter(SoilImage.id == i_id).first()
            if rec:
                if rec.file_path and os.path.exists(rec.file_path):
                    os.remove(rec.file_path)
                if rec.processed_path and os.path.exists(rec.processed_path):
                    os.remove(rec.processed_path)
                db.delete(rec)
                db.commit()

        # Cleanup test users and their cascaded data
        if user_a:
            ua = db.query(User).filter(User.id == user_a.id).first()
            if ua:
                db.delete(ua)
                db.commit()
        if user_b:
            ub = db.query(User).filter(User.id == user_b.id).first()
            if ub:
                db.delete(ub)
                db.commit()
        db.close()

if __name__ == "__main__":
    test_full_image_workflow()
