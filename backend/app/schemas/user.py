from pydantic import BaseModel
from typing import Optional

class UserResponse(BaseModel):
    id:str
    username: str
    firstName: Optional[str] = None
    lastName: Optional[str] = None
    email: str