from fastapi import FastAPI

from app.api import items,auth
from app import firebase

app = FastAPI(
    title="Grocery Price Pal API",
    description="Backend API for Grocery Price Pal",
    version="0.1.0"
)

app.include_router(
    items.router,
    prefix="/api/v1"
)
app.include_router(
    auth.router,
    prefix="/api/v1"
)

@app.get("/health")
def health_check():
    return{
        "status": "ok"
    }