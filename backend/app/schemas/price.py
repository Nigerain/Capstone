from pydantic import BaseModel, Field
from datetime import date
from typing import Optional

from app.schemas.item import ItemResponse
from app.schemas.store import StoreResponse

class PriceResponse(BaseModel):
    id: str
    itemId: str
    storeId: str
    userId: str
    price: float
    dateRecorded: date
    isPublic: bool

# Return item units with price history
class PriceItem(ItemResponse):
    unitSize: Optional[str] = None

# Return store coordinates with price history
class PriceStore(StoreResponse):
    pass

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
