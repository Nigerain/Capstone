from fastapi import APIRouter, Query, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from app.api.auth import get_current_user, security
from app.schemas.store import StoreResponse
from app.service.dataconnect import search_stores


router = APIRouter(
    prefix='/stores',
    tags=["Stores"]
)

@router.get("/search", response_model=list[StoreResponse])
def search_stores_endpoint(
    q: str = Query(..., min_length=1),
    current_user:dict = Depends(get_current_user),
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    try:
        return search_stores(
            pattern=q,
            id_token=credentials.credentials
        )

    except Exception as e:
        print(f"Data Connect error:  {type(e).__name__}: {e}")
        raise HTTPException(
            status_code=502,
            detail="Unable to retrieve stores from Data Connect"
        )
