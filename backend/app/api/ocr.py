from io import BytesIO
from fastapi import APIRouter, Depends, File, UploadFile, HTTPException, Request
from starlette.concurrency import run_in_threadpool
from app.ocr.extractor import scan_price_bytes
from app.api.auth import get_current_user

from datetime import date
from collections import defaultdict


router = APIRouter(
    prefix="/ocr",
    tags=["OCR"]
)

DAILY_SCAN_LIMIT = 10
MAX_IMAGE_SIZE = 5 * 1024 * 1024

scan_counts = defaultdict(lambda:
    {
        "date": date.today(),
        "count": 0
    })

@router.post("/scan")
async def scan_price(
    image: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
    
):
    """
    Accept a price-tag image from an authenticated user. 
    Return structured price-tag extraction from Google Vision.
    """
    
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail="uploaded file must be an image"
        )
        
    # reject empty or oversized uploads before calling Vision.
    image_bytes = await image.read(MAX_IMAGE_SIZE + 1)
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Uploaded image is empty")
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
            detail="Daily OCR scan limit reached"
        )
    
    user_scans["count"] += 1
    try:
        # run the blocking Vision request outside the event loop.
        result = await run_in_threadpool(scan_price_bytes, image_bytes)
    except RuntimeError:
        raise HTTPException(status_code=503, detail="OCR service unavailable") from None

    return {**result, "scansRemaining": DAILY_SCAN_LIMIT - user_scans["count"]}


# accept raw JPEG uploads while keeping Firebase token verification.
@router.post("/scan-jpeg")
async def scan_jpeg(
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    if request.headers.get("content-type", "").split(";")[0].strip().lower() != "image/jpeg":
        raise HTTPException(status_code=415, detail="Expected image/jpeg")

    photo = BytesIO()
    async for chunk in request.stream():
        if photo.tell() + len(chunk) > MAX_IMAGE_SIZE:
            photo.close()
            raise HTTPException(status_code=413, detail="Image must be 5 MB or smaller")
        photo.write(chunk)
    photo.seek(0)

    # reuse the same validation, quota, and extractor for both upload formats.
    image = UploadFile(photo, filename="price-tag.jpg", headers=request.headers)
    try:
        return await scan_price(image=image, current_user=current_user)
    finally:
        await image.close()