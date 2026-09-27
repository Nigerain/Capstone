from pydantic import BaseModel, Field
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


class PriceCreate(BaseModel):
    itemId: str
    storeId: str
    price: float = Field(gt=0)
    isPublic: bool = True