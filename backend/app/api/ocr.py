from fastapi import APIRouter, Depends, File, UploadFile, HTTPException
from app.api.auth import get_current_user

from google.cloud import vision
from google.api_core.exceptions import GoogleAPICallError

from datetime import date
from collections import defaultdict

router = APIRouter(prefix="/ocr", tags=["OCR"])

DAILY_SCAN_LIMIT = 10
MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5 MB

scan_counts = defaultdict(lambda: {"date": date.today(), "count": 0})


@router.post("/scan")
async def scan_price(
    image: UploadFile = File(...), current_user: dict = Depends(get_current_user)
):
    """
    Accept a price-tag image from an authenticated user.
    Gooogle Vision processing will be added here
    """

    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Uploaded file must be an image")
    image_bytes = await image.read(MAX_IMAGE_SIZE + 1)

    if not image_bytes:
        raise HTTPException(status_code=400, detail="Uploaded image is empty.")

    if len(image_bytes) > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=413, detail="Image must be 5 MB or smaller")

    user_id = current_user["uid"]
    user_scans = scan_counts[user_id]
    today = date.today()

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
        client = vision.ImageAnnotatorClient()
        vision_image = vision.Image(content=image_bytes)

        response = client.text_detection(image=vision_image)

        if response.error.message:
            raise HTTPException(
                status_code=502,
                detail="Google Vision could not process the image",
            )

            extracted_text = (
                response.text_annotations[0].description
                if response.text_annotations
                else ""
            )
    except HTTPException:
        raise

    except (GoogleAPICallError, Exception):
        raise HTTPException(status_code=502, detail="OCR processing failed")

    user_scans["count"] += 1

    return {
        "text": extracted_text,
        "scansRemaining": DAILY_SCAN_LIMIT - user_scans["count"],
    }
