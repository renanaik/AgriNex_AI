import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import UPLOAD_DIR, SOIL_IMAGES_DIR, PROCESSED_DIR
from database import engine, Base
from routers.auth_router import router as auth_router
from routers.farm_router import router as farm_router
from routers.soil_test_router import router as soil_test_router
from routers.image_router import router as image_router
from routers.soil_classifier_router import router as soil_classifier_router
from soil_classifier import classifier_service


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: create all tables, required directories, and verify ML model."""
    Base.metadata.create_all(bind=engine)
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    os.makedirs(SOIL_IMAGES_DIR, exist_ok=True)
    os.makedirs(PROCESSED_DIR, exist_ok=True)
    if classifier_service.is_loaded:
        print(f"[AgriNex ML] MobileNetV3 Soil Classifier loaded successfully on {classifier_service.device}.")
    else:
        print("[AgriNex ML] Warning: Soil Classifier model could not be loaded on startup.")
    yield


app = FastAPI(
    title="AgriNex Soil Health API",
    lifespan=lifespan,
)

# CORS middleware — allow the Vite dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router)
app.include_router(farm_router)
app.include_router(soil_test_router)
app.include_router(image_router)
app.include_router(soil_classifier_router)


@app.get("/")
def root():
    return {"message": "AgriNex Soil Health API"}
