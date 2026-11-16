from fastapi import APIRouter, Depends, File, UploadFile, HTTPException
from app.api.auth import get_current_user

from app.service.ocr_scanner import scan_price_bytes

from app.schemas.ocr import OCRScanResponse


from datetime import date
from collections import defaultdict

router = APIRouter(prefix="/ocr", tags=["OCR"])

DAILY_SCAN_LIMIT = 10
MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5 MB

scan_counts = defaultdict(lambda: {"date": date.today(), "count": 0})


@router.post("/scan", response_model=OCRScanResponse)
async def scan_price(
    image: UploadFile = File(...), current_user: dict = Depends(get_current_user)
):
    """
    Accept a price-tag image from an authenticated user.
    Gooogle Vision processing will be added here
    """

    ALLOWED_IMAGE_TYPES = {
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
        "image/bmp",
        "image/tiff",
    }
    if image.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Unsupported image format. Please upload a JPG, PNG, WEBP, GIF, BMP, or TIFF image.",
        )

    image_bytes = await image.read(MAX_IMAGE_SIZE + 1)

    if not image_bytes:
        raise HTTPException(status_code=400, detail="Uploaded image is empty.")

    if len(image_bytes) > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=413, detail="Image must be 5 MB or smaller")

    user_id = current_user["uid"]
    user_scans = scan_counts[user_id]

    # Reset count when a new day starts
    if user_scans["date"] != date.today():
        user_scans["date"] = date.today()
        user_scans["count"] = 0

    # Stop the request if the user reached the daily limit
    if user_scans["count"] >= DAILY_SCAN_LIMIT:
        raise HTTPException(
            status_code=429,
            detail="Daily OCR scan limit reached",
        )

    try:
        result = scan_price_bytes(image_bytes)

    except Exception as e:
        print("OCR processing error:", str(e))
        raise HTTPException(
            status_code=502,
            detail="OCR processing failed. Please try again.",
        )

    if result.get("reason") == "read_failed":
        raise HTTPException(
            status_code=422,
            detail="The image could not be read. Please try another photo.",
        )

    user_scans["count"] += 1

    return {
        **result,
        "scansRemaining": DAILY_SCAN_LIMIT - user_scans["count"],
    }
