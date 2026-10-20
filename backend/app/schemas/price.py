from pydantic import BaseModel, Field
from datetime import date
from typing import Optional


class PriceResponse(BaseModel):
    id: str
    itemId: str
    storeId: str
    userId: str
    price: float
    dateRecorded: date
    isPublic: bool

class PriceItem(BaseModel):
    id: str
    itemName: str
    brand: Optional[str] = None
    unitSize: Optional[str] = None

class PriceStore(BaseModel):
    id: str
    storeName: str
    storeLocation: Optional[str] = None

class PriceHistoryRecord(BaseModel):
    id: str
    price: float
    dateRecorded: date
    isPublic: bool
    item: PriceItem
    store: PriceStore


class ItemPricesResponse(BaseModel):
    item_id: str
    prices: list[PriceHistoryRecord]


class PriceCreate(BaseModel):
    itemId: str
    storeId: str
    price: float = Field(gt=0)
    isPublic: bool = True