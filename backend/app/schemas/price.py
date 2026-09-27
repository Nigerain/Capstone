from pydantic import BaseModel 
from typing import Optional 
from datetime import date

class PriceResponse(BaseModel):
    id: str
    itemId: str
    storeId: str
    userId: str
    price: float
    dateRecorded: date
    isPublic: bool


class ItemPricesResponse(BaseModel):
    item_id: str
    prices: list[PriceResponse]


