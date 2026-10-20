from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel, Field

from app.api.auth import get_current_user, security
from app.service.dataconnect import create_user_profile as db_create_user_profile

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
