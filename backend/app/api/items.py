from fastapi import status
from fastapi import APIRouter, Query, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from app.api.auth import get_current_user, security
from app.schemas.item import ItemSearchResponse
from app.schemas.price import ItemPricesResponse
from app.service.dataconnect import search_items as db_search_items
from app.service.dataconnect import get_item_prices as db_get_item_prices
from app.service.dataconnect import create_item as db_create_item

from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/items", tags=["Items"])


@router.get("/search", response_model=ItemSearchResponse)
def search_items(
    q: str = Query(..., min_length=1),
    current_user: dict = Depends(get_current_user),
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """
    Search for grocery items using Firebase Data Connect.
    """
    try:
        items = db_search_items(pattern=q, id_token=credentials.credentials)

        return {"results": items}

    except Exception as e:
        print(f"Data Connect items search error: {type(e).__name__}: {e}")

        raise HTTPException(
            status_code=502, detail="Unable to retrieve items from Data Connect"
        )


@router.get("/{item_id}/prices", response_model=ItemPricesResponse)
def get_item_prices(
    item_id: str,
    current_user: dict = Depends(get_current_user),
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """
    Get real price history for an item from Firebase Data Connect.

    """

    try:
        prices = db_get_item_prices(item_id=item_id, id_token=credentials.credentials)

        return {"item_id": item_id, "prices": prices}

    except Exception as e:
        print(f"Data Connect items search error: {type(e).__name__}: {e}")

        raise HTTPException(
            status_code=502,
            detail="Unable to retrieve item price history from Data Connect",
        )


class ItemCreate(BaseModel):
    itemName: str
    brand: Optional[str] = None
    unitAmount: Optional[float] = None
    unit: Optional[str] = None


@router.post("", status_code=status.HTTP_201_CREATED)
def create_item(
    item: ItemCreate,
    current_user: dict = Depends(get_current_user),
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """
    Create a new grocery item in firebase data connect.
    User must be logged in.
    """

    try:
        result = db_create_item(
            item_name=item.itemName,
            brand=item.brand,
            unit_amount=item.unitAmount,
            unit=item.unit,
            id_token=credentials.credentials,
        )
        return result

    except Exception as e:
        print(f"Data connect item creation error: {type(e).__name__}: {e}")

        raise HTTPException(
            status_code=502, detail="Unable to create item in data connect"
        )
