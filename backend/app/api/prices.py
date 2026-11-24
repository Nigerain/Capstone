from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel, Field

from app.api.auth import get_current_user, security
from app.schemas.price import PriceCreate
from app.service.dataconnect import create_price as db_create_price
from app.service.dataconnect import update_price as db_update_price
from app.service.dataconnect import submit_price_vote as db_submit_price_vote
from app.service.dataconnect import remove_price_vote as db_remove_price_vote
from app.service.dataconnect import get_price_votes as db_get_price_votes


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


class PriceVoteCreate(BaseModel):
    isUpvote: bool


@router.post("/{price_id}/votes", status_code=status.HTTP_200_OK)
def submit_price_vote(
    price_id: str,
    vote: PriceVoteCreate,
    current_user: dict = Depends(get_current_user),
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """
    Submit or change a vote on a grocery price.
    true = confirm price
    false = flag price
    User must be logged in.
    """

    try:
        result = db_submit_price_vote(
            price_record_id=price_id,
            is_upvote=vote.isUpvote,
            id_token=credentials.credentials,
        )

        return {
            "message": "Price vote submitted successfully",
            "data": result,
        }

    except DataConnectError as e:
        print(f"Data connect rejected price vote: {e.code}: {e.message}")

        if "Create your user profile first" in e.message:
            raise HTTPException(
                status_code=409,
                detail=(
                    "Cannot vote on this price. It may be private or inactive,"
                    "or you may have already submitted this price."
                ),
            )
        raise HTTPException(
            status_code=502,
            detail="Unable to submit price vote.",
        )

    except Exception as e:
        print(f"Unexpected price voting error: {type(e).__name__}: {e}")

        raise HTTPException(status_code=502, detail="Unable to submite price vote")


@router.delete("/{price_id}/votes", status_code=status.HTTP_200_OK)
def remove_price_vote(
    price_id: str,
    current_user: dict = Depends(get_current_user),
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """
    Remove the logged in users vote from a price.
    """

    try:
        result = db_remove_price_vote(
            price_record_id=price_id,
            id_token=credentials.credentials,
        )
        return {
            "message": "Price vote removal request completed",
            "data": result,
        }

    except DataConnectError as e:
        print(f"Data Connect rejected vote removal: {e.code}: {e.message}")

        if "Create your user profile first" in e.message:
            raise HTTPException(
                status_code=409,
                detail="Create your user profile before removing votes.",
            )

        raise HTTPException(
            status_code=502,
            detail="Unable to remove price vote.",
        )

    except Exception as e:
        print(f"Unexpected vote removal error: {type(e).__name__}: {e}")

        raise HTTPException(status_code=502, detail="Unable to remove price vote.")


@router.get("/{price_id}/votes")
def get_price_votes(
    price_id: str,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: dict = Depends(get_current_user),
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """
    Retrieve votes for a grocery price.
    Supports pagination using limit and offset.
    User must be authenticated.
    """

    try:
        votes = db_get_price_votes(
            price_record_id=price_id,
            limit=limit,
            offset=offset,
            id_token=credentials.credentials,
        )

        return {
            "priceRecordId": price_id,
            "votes": votes,
            "count": len(votes),
        }

    except DataConnectError as e:
        print(f"Data Connect rejected vote retrieval: {e.code}: {e.message}")

        raise HTTPException(
            status_code=502,
            detail="Unable to retrieve price votes.",
        )

    except Exception as e:
        print(f"Unexpected vote retrieval error: {type(e).__name__}: {e}")

        raise HTTPException(
            status_code=502,
            detail="Unable to retrieve price votes.",
        )
