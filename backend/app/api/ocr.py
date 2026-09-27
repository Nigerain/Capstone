from fastapi import APIRouter, Depends, File, UploadFile, HTTPException
from app.api.auth import get_current_user

from datetime import date
from collections import defaultdict


router = APIRouter(
    prefix="/ocr",
    tags=["OCR"]
)

DAILY_SCAN_LIMIT = 10

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
    Gooogle Vision processing will be added here
    """
    
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail="uploaded file must be an image"
        )
        
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
            
    image_bytes = await image.read()
    
    return{
        "message": "Image received successfully",
        "filename": image.filename,
        "contentType": image.content_type,
        "size": len(image_bytes),
        "userId": current_user["uid"],
        "scansRemaining": DAILY_SCAN_LIMIT - user_scans["count"]
    
    }