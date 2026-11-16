from typing import Optional
from pydantic import BaseModel 

class OCRScanResponse(BaseModel):
    status: str
    reason: Optional[str] = None
    itemName: Optional[str] = None 
    brand: Optional[str] = None
    unitSize: Optional[str] = None
    price: Optional[str] = None 
    priceConfidence: float
    scansRemaining: int
    
    
