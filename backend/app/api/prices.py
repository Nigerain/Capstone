from datetime import date

from fastapi import APIRouter, Depends
from app.api.auth import get_current_user
from app.schemas.price import PriceCreate, PriceResponse

router = APIRouter(
    prefix="/prices",
    tags=["Prices"]
)

@router.post("", response_model=PriceResponse)
def create_price(
    price: PriceCreate,
    current_user: dict = Depends(get_current_user)
    
): 
    """
    Submit a new grocery price. 
    User must be logged in.
    """

    return{
        "id":"price_003",
        "itemId": price.itemId,
        "storeId": price.storeId,
        "userId": current_user["uid"],
        "price": price.price,
        "dateRecorded": date.today(),
        "isPublic": price.isPublic
    }
    