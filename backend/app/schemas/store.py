from pydantic import BaseModel 
from typing import Optional 

class StoreResponse(BaseModel):
    id:str
    storeName: str
    storeLocation: Optional[str] = None
    