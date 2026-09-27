from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from firebase_admin import auth


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"]
)

security = HTTPBearer()

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """ 
    Verify the firebase ID token sent by the frontend.
    """
    token = credentials.credentials

    try:
        decoded_token = auth.verify_id_token(token)
        return decoded_token

    except Exception as e:
        raise HTTPException(
            status_code=401,
            detail=str(e)
        )

@router.get("/me")
def get_me(
    current_user: dict = Depends(get_current_user)
):

    return {
        "uid": current_user.get("uid"),
        "email":current_user.get("email")
    }