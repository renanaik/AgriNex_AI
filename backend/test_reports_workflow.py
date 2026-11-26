import pytest
from fastapi.testclient import TestClient
from main import app
from database import engine, SessionLocal
from models import User, Farm, SoilTest
from auth import create_access_token
import uuid

def test_detailed_report_verification():
    print("==================================================================")
    print("VERIFYING DETAILED SOIL REPORT WORKFLOW AGAINST POSTGRESQL")
    print("==================================================================")

    db = SessionLocal()
    client = TestClient(app)

    test_uid = uuid.uuid4().hex[:6]
    user = User(
        full_name=f"Report Tester {test_uid}",
        email=f"report_tester_{test_uid}@agrinex.org",
        password_hash="mock_hash",
        language_preference="en",
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    try:
        # Create Farm 1 and Farm 2
        farm1 = Farm(user_id=user.id, farm_name="Sunrise Farm", field_name="East Ridge", soil_type="Loamy")
        farm2 = Farm(user_id=user.id, farm_name="Valley Farm", field_name="Plot B", soil_type="Clay")
        db.add_all([farm1, farm2])
        db.commit()
        db.refresh(farm1)
        db.refresh(farm2)

        # Create Report 1 (Healthy soil)
        test1 = SoilTest(
            user_id=user.id,
            farm_id=farm1.id,
            nitrogen=160.0,
            phosphorus=55.0,
            potassium=220.0,
            ph=7.0,
            organic_matter=3.5,
            moisture=30.0,
            status="Healthy",
            notes="Regular composting applied in March.",
        )

        # Create Report 2 (Acidic & Deficient soil)
        test2 = SoilTest(
            user_id=user.id,
            farm_id=farm2.id,
            nitrogen=60.0,
            phosphorus=15.0,
            potassium=90.0,
            ph=5.2,
            organic_matter=1.2,
            moisture=12.0,
            status="Poor",
            notes="Heavy leaching observed after unseasonal rainfall.",
        )

        db.add_all([test1, test2])
        db.commit()
        db.refresh(test1)
        db.refresh(test2)

        token = create_access_token(data={"sub": str(user.id), "email": user.email})
        headers = {"Authorization": f"Bearer {token}"}

        print("\n[1] Testing Reports List Retrieval from PostgreSQL...")
        list_res = client.get("/api/soil-tests/", headers=headers)
        assert list_res.status_code == 200
        tests_list = list_res.json()
        assert len(tests_list) == 2
        print(f" -> Found {len(tests_list)} reports in database.")

        print("\n[2] Testing Clicking & Viewing Report 1 (ID={test1.id})...")
        r1_res = client.get(f"/api/soil-tests/{test1.id}", headers=headers)
        assert r1_res.status_code == 200
        d1 = r1_res.json()
        assert d1["nitrogen"] == 160.0
        assert d1["phosphorus"] == 55.0
        assert d1["potassium"] == 220.0
        assert d1["ph"] == 7.0
        assert d1["organic_matter"] == 3.5
        assert d1["moisture"] == 30.0
        assert d1["status"] == "Healthy"

        farm1_res = client.get(f"/api/farms/{d1['farm_id']}", headers=headers)
        assert farm1_res.status_code == 200
        f1_data = farm1_res.json()
        assert f1_data["farm_name"] == "Sunrise Farm"
        assert f1_data["field_name"] == "East Ridge"
        assert f1_data["soil_type"] == "Loamy"
        print(" -> Report 1 details verified: Sunrise Farm, East Ridge, Loamy, Healthy, N=160, P=55, K=220, pH=7.0, OM=3.5%, Moisture=30%.")

        print("\n[3] Testing Clicking & Viewing Report 2 (ID={test2.id})...")
        r2_res = client.get(f"/api/soil-tests/{test2.id}", headers=headers)
        assert r2_res.status_code == 200
        d2 = r2_res.json()
        assert d2["nitrogen"] == 60.0
        assert d2["phosphorus"] == 15.0
        assert d2["potassium"] == 90.0
        assert d2["ph"] == 5.2
        assert d2["organic_matter"] == 1.2
        assert d2["moisture"] == 12.0
        assert d2["status"] == "Poor"

        farm2_res = client.get(f"/api/farms/{d2['farm_id']}", headers=headers)
        assert farm2_res.status_code == 200
        f2_data = farm2_res.json()
        assert f2_data["farm_name"] == "Valley Farm"
        assert f2_data["field_name"] == "Plot B"
        assert f2_data["soil_type"] == "Clay"
        print(" -> Report 2 details verified: Valley Farm, Plot B, Clay, Poor, N=60, P=15, K=90, pH=5.2, OM=1.2%, Moisture=12%.")

        print("\n[4] Verifying Data Independence & No Cross-Contamination...")
        assert d1["id"] != d2["id"]
        assert d1["nitrogen"] != d2["nitrogen"]
        assert f1_data["farm_name"] != f2_data["farm_name"]
        print(" -> Verified: Report 1 and Report 2 display completely independent and accurate data from PostgreSQL.")

        print("\n==================================================================")
        print("ALL DETAILED REPORT WORKFLOW TESTS PASSED (100%)")
        print("==================================================================")

    finally:
        db.delete(user)
        db.commit()
        db.close()

if __name__ == "__main__":
    test_detailed_report_verification()
