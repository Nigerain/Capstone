from pydantic import BaseModel
from typing import Optional


class ItemResponse(BaseModel):
    id: str
    itemName: str
    brand: Optional[str] = None
    unitAmount: Optional[float] = None
    unit: Optional[str] = None


class ItemSearchResponse(BaseModel):
    results: list[ItemResponse]
