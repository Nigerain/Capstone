from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel, Field

from app.api.auth import get_current_user, security
from app.schemas.price import PriceCreate
from app.service.dataconnect import create_price as db_create_price
from app.service.dataconnect import update_price as db_update_price

from app.service.dataconnect import DataConnectError

router = APIRouter(prefix="/prices", tags=["Prices"])


@router.post("", status_code=status.HTTP_201_CREATED)
def create_price(
    price: PriceCreate,
    current_user: dict = Depends(get_current_user),
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """
    Submit a new grocery price using Firebase Data Connect.
    User must be logged in.
    """
    try:
        db_create_price(
            item_id=price.itemId,
            store_id=price.storeId,
            price=price.price,
            is_public=price.isPublic,
            id_token=credentials.credentials,
        )

        return {"message": "Price submitted successfully"}

    except DataConnectError as e:
        print(f"Data connect price rejected price submission: {e.code}: {e.message}")

        if "Create your user profile first" in e.message:
            raise HTTPException(
                status_code=409,
                detail="Create a user profile before submitting prices",
            )
        if "Invalid price, already supporting this pool" in e.message:
            raise HTTPException(
                status_code=409,
                detail=(
                    "Price submission rejected. You may already support this price,"
                    "have voted on it, or entered invalid amount."
                ),
            )
        raise HTTPException(
            status_code=502,
            detail="Unable to submit price",
        )
    except Exception as e:
        print(f"Unexpected price submission error: {type(e).__name__}: {e}")

        raise HTTPException(
            status_code=502,
            detail="Unable to submit price.",
        )


class PriceUpdate(BaseModel):
    price: float = Field(gt=0, le=99999.99)


@router.patch("/{price_id}")
def update_price(
    price_id: str,
    price_update: PriceUpdate,
    current_user: dict = Depends(get_current_user),
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """
    Update the logged-in user's existing price submissions.
    """
    try:
        result = db_update_price(
            price_record_id=price_id,
            price=price_update.price,
            id_token=credentials.credentials,
        )

        return {
            "message": "Price updated successfully",
            "data": result,
        }

    except DataConnectError as e:
        print(f"Data connect rejected price update: {e.code}: {e.message}")

        if "Create User profile first" in e.message:
            raise HTTPException(
                status_code=409,
                detail="Create your user profile before updating prices.",
            )
        if "Cannot move this submission" in e.message:
            raise HTTPException(
                status_code=409,
                detail="Price update rejected. Check that you submitted this price, entered a different amount, and haven't voted on the destination price.",
            )

        raise HTTPException(
            status_code=502,
            detail="Unable to update price",
        )

    except Exception as e:
        print(f"Unexpected price update error: {type(e).__name__}: {e}")

        raise HTTPException(
            status_code=502,
            detail="Unable to update price",
        )
