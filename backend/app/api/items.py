from fastapi import APIRouter, Query
from app.schemas.item import ItemSearchResponse
from app.schemas.price import ItemPricesResponse

router = APIRouter(
    prefix="/items",
    tags=["Items"]
)

@router.get(
    "/search",
    response_model=ItemSearchResponse
    )
def search_items(q: str = Query(...,min_length=1)):
    """
    Search for grocery items. 

    Temporary fake data!
    """

    return{
        "results":[
            {
                "id": "item_001",
                "itemName": "Chicken Breast",
                "brand": "Perdue",
                "unitSize": "1 lb",
            },
            {
                "id": "item_002",
                "itemName": "Chicken Wings",
                "brand": "Tyson",
                "unitSize":'1 lb'
            },
        ]
    }

@router.get(
    "/{item_id}/prices",
    response_model=ItemPricesResponse
)
def get_item_prices(item_id:str):
    """
    Get price records for a specific grocery item. 
    MOCK DATA
    """

    return{
        "item_id": item_id,
        "prices": [
            {
                "id": "price_001",
                "itemId": item_id,
                "storeId": "store_001",
                "userId": "user_001",
                "price": 1.99,
                "dateRecorded": "2026-09-27",
                "isPublic": True
            },
            {
                "id": "price_002",
                "itemId": item_id,
                "storeId": "store_002",
                "userId": "user_002",
                "price": 2.49,
                "dateRecorded": "2026-09-26",
                "isPublic": True
            }
        ]
    }