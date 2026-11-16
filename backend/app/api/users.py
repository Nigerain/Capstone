from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel, Field

from app.api.auth import get_current_user, security
from app.service.dataconnect import create_user_profile as db_create_user_profile
from app.service.dataconnect import get_user_stats as db_get_user_stats
from app.service.dataconnect import DataConnectError
from app.service.dataconnect import (
    get_submitter_vote_history as db_get_submitter_vote_history,
)

router = APIRouter(prefix="/users", tags=["Users"])


class UserProfileCreate(BaseModel):
    username: str = Field(min_length=1)
    firstName: str = Field(min_length=1)
    lastName: str = Field(min_length=1)


@router.post("/profile", status_code=status.HTTP_201_CREATED)
def create_user_profile(
    profile: UserProfileCreate,
    current_user: dict = Depends(get_current_user),
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """
    Create a user profile in firebase data connect.

    """
    try:
        return db_create_user_profile(
            username=profile.username,
            first_name=profile.firstName,
            last_name=profile.lastName,
            id_token=credentials.credentials,
        )

    except Exception as e:
        print(f"Data connect profile creation error: {type(e).__name__}: {e}")

        raise HTTPException(
            status_code=502, detail="Unable to create user profile in Data Connect"
        )

@router.get("/{user_id}/stats")
def get_user_stats(
    user_id: str,
    current_user: dict = Depends(get_current_user),
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """
    Retrieve a user's account information and public price submission count. 
    User must be authenticated.
    """
    
    try: 
        result = db_get_user_stats(
            user_id=user_id,
            id_token=credentials.credentials,
        )
        
        if not result.get("user"):
            raise HTTPException(
                status_code=404,
                detail="User not found.",
            )
            
        return{
            "user": result.get("user"),
            "totalSubmissions": result.get("totalSubmissions"),
        }
    except HTTPException:
        raise
    
    except DataConnectError as e:
        print(f"Data Connect user statistics error: {e.code}: {e.message}")
        
        raise HTTPException(
            status_code=502,
            detail="Unable to retrieve user statistics.",
        )
        
    except Exception as e:
        print(f"Unexpected user statistics error: {type(e).__name__}: {e}")
        
        raise HTTPException(
            status_code=502,
            detail="Unable to retrieve user statistics.",
        )


@router.get("/{user_id}/vote-history")
def get_submitter_vote_history(
    user_id: str,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: dict = Depends(get_current_user),
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """
    Retrieve a user's public price submission history
    and the upvotes/downvotes received on each submission.
    """
    
    try: 
        history = db_get_submitter_vote_history(
            user_id=user_id,
            limit=limit,
            offset=offset,
            id_token=credentials.credentials,
        )
        
        return {
            "userId": user_id,
            "priceHistory": history,
            "count": len(history),
        }
    except DataConnectError as e:
        print(f"Data connect vote history error: {e.code}: {e.message}")
        
        raise HTTPException(
            status_code=502,
            detail="Unable to retrieve submission voting history.",
        )
        
    except Exception as e:
        print(f"Unexpected vote history error: {type(e).__name__}: {e}")
        
        raise HTTPException(
            status_code=502,
            detail="Unable to retrieve submission voting history.",
        )
    