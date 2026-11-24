from fastapi import status
from fastapi import APIRouter, Query, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from app.api.auth import get_current_user, security
from app.schemas.item import ItemSearchResponse
from app.schemas.price import ItemPricesResponse
from app.service.dataconnect import search_items as db_search_items
from app.service.dataconnect import get_item_prices as db_get_item_prices
from app.service.dataconnect import create_item as db_create_item

from enum import Enum
from pydantic import BaseModel, Field
from typing import Optional

import requests

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

    except requests.exceptions.Timeout:
        raise HTTPException(
            status_code=504,
            detail="Firebase Data Connect request timed out",
        )
    except requests.exceptions.RequestException as e:
        print(f"Firebase connection error: {type(e).__name__}: {e}")
        raise HTTPException(
            status_code=502,
            detail="Unable to communicate with Firebase Data Connect",
        )
    except ValueError as e:
        print(f"Firebase operation error: {e}")

        raise HTTPException(
            status_code=502,
            detail="Firebase Data Connect operation failed",
        )

    except Exception as e:
        print(f"Unexpected backend error: {type(e).__name__}: {e}")

        raise HTTPException(
            status_code=500,
            detail="An unexpected server error occurred",
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

    except requests.exceptions.Timeout:
        raise HTTPException(
            status_code=504,
            detail="Firebase Data Connect request timed out",
        )
    except requests.exceptions.RequestException as e:
        print(f"Firebase connection error: {type(e).__name__}: {e}")
        raise HTTPException(
            status_code=502,
            detail="Unable to communicate with Firebase Data Connect",
        )
    except ValueError as e:
        print(f"Firebase operation error: {e}")

        raise HTTPException(
            status_code=502,
            detail="Firebase Data Connect operation failed",
        )

    except Exception as e:
        print(f"Unexpected backend error: {type(e).__name__}: {e}")

        raise HTTPException(
            status_code=500,
            detail="An unexpected server error occurred",
        )


class GroceryUnit(str, Enum):
    LB = "LB"
    OZ = "OZ"
    G = "G"
    KG = "KG"
    ML = "ML"
    L = "L"
    FL_OZ = "FL_OZ"
    PT = "PT"
    QT = "QT"
    GAL = "GAL"
    EACH = "EACH"
    DOZEN = "DOZEN"
    SERVING = "SERVING"
    PACK = "PACK"
    LOAF = "LOAF"


class ItemCreate(BaseModel):
    itemName: str
    brand: Optional[str] = None
    unitAmount: Optional[float] = Field(default=None, gt=0)
    unit: Optional[GroceryUnit] = None


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
            unit=item.unit.value if item.unit else None,
            id_token=credentials.credentials,
        )
        return result

    except requests.exceptions.Timeout:
        raise HTTPException(
            status_code=504,
            detail="Firebase Data Connect request timed out",
        )
    except requests.exceptions.RequestException as e:
        print(f"Firebase connection error: {type(e).__name__}: {e}")
        raise HTTPException(
            status_code=502,
            detail="Unable to communicate with Firebase Data Connect",
        )
    except ValueError as e:
        print(f"Firebase operation error: {e}")

        raise HTTPException(
            status_code=502,
            detail="Firebase Data Connect operation failed",
        )

    except Exception as e:
        print(f"Unexpected backend error: {type(e).__name__}: {e}")

        raise HTTPException(
            status_code=500,
            detail="An unexpected server error occurred",
        )
