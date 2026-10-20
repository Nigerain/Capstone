import requests
from typing import Optional


class DataConnectError(Exception):
    def __init__(self, message: str, code: str = "UNKNOWN"):
        self.message = message
        self.code = code
        super().__init__(message)


DATA_CONNECT_URL = (
    "https://firebasedataconnect.googleapis.com/v1/"
    "projects/grocerypricepal/locations/us-east4/"
    "services/grocerypricepal-service/connectors/endpoint:executeQuery"
)


# Search stores in database
def search_stores(pattern: str, id_token: str):
    response = requests.post(
        DATA_CONNECT_URL,
        headers={
            "X-FireBase-Auth-Token": id_token,
            "Content-Type": "application/json",
        },
        json={
            "operationName": "SearchStores",
            "variables": {"pattern": f"%{pattern}%"},
        },
        timeout=15,
    )
    response.raise_for_status()

    result = response.json()

    if result.get("errors"):
        raise ValueError("Data Connect query failed")

    return result.get("data", {}).get("stores", [])


# Search Items in database
def search_items(pattern: str, id_token: str):
    response = requests.post(
        DATA_CONNECT_URL,
        headers={
            "X-FireBase-Auth-Token": id_token,
            "Content-Type": "application/json",
        },
        json={
            "operationName": "SearchItems",
            "variables": {"pattern": f"%{pattern}%"},
        },
        timeout=15,
    )
    response.raise_for_status()

    result = response.json()

    if result.get("errors"):
        raise ValueError("Data Connect query failed")

    return result.get("data", {}).get("items", [])


# Get historical item prices
def get_item_prices(item_id: str, id_token: str):
    response = requests.post(
        DATA_CONNECT_URL,
        headers={
            "X-FireBase-Auth-Token": id_token,
            "Content-Type": "application/json",
        },
        json={
            "operationName": "GetItemPrices",
            "variables": {"itemId": item_id},
        },
        timeout=15,
    )

    response.raise_for_status()

    result = response.json()

    if result.get("errors"):
        raise ValueError("Data connect price history query failed")

    return result.get("data", {}).get("priceRecords", [])


# Create prices
def create_price(
    item_id: str, store_id: str, price: float, is_public: bool, id_token: str
):
    response = requests.post(
        DATA_CONNECT_URL.replace(":executeQuery", ":executeMutation"),
        headers={
            "X-FireBase-Auth-Token": id_token,
            "Content-Type": "application/json",
        },
        json={
            "operationName": "CreatePrice",
            "variables": {
                "itemId": item_id,
                "storeId": store_id,
                "price": price,
                "isPublic": is_public,
            },
        },
        timeout=15,
    )

    response.raise_for_status()

    result = response.json()

    if result.get("errors"):
        error = result["errors"][0]

        raise DataConnectError(
            message=error.get("message", "Price submission failed"),
            code=error.get("extensions", {}).get("code", "UNKNOWN"),
        )

    return result.get("data", {})


# Create item
def create_item(
    item_name: str,
    brand: Optional[str],
    unit_amount: Optional[float],
    unit: Optional[str],
    id_token: str,
):
    response = requests.post(
        DATA_CONNECT_URL.replace(":executeQuery", ":executeMutation"),
        headers={
            "X-FireBase-Auth-Token": id_token,
            "Content-Type": "application/json",
        },
        json={
            "operationName": "CreateItem",
            "variables": {
                "itemName": item_name,
                "brand": brand,
                "unitAmount": unit_amount,
                "unit": unit,
            },
        },
        timeout=15,
    )

    response.raise_for_status()

    result = response.json()

    if result.get("errors"):
        raise ValueError(f"Data connect item creation failed: {result['errors']}")

    return result.get("data", {}).get("item_insert", {})


# Create User profile
def create_user_profile(username: str, first_name: str, last_name: str, id_token: str):
    response = requests.post(
        DATA_CONNECT_URL.replace(":executeQuery", ":executeMutation"),
        headers={
            "X-FireBase-Auth-Token": id_token,
            "Content-Type": "application/json",
        },
        json={
            "operationName": "CreateUserProfile",
            "variables": {
                "username": username,
                "firstName": first_name,
                "lastName": last_name,
            },
        },
        timeout=15,
    )

    response.raise_for_status()

    result = response.json()

    if result.get("errors"):
        raise ValueError(f"Data connect profile creation failed: {result['errors']}")

    return result.get("data", {}).get("user_insert", {})


# Update a user's existing price submission
def update_price(price_record_id: str, price: float, id_token: str):
    response = requests.post(
        DATA_CONNECT_URL.replace(":executeQuery", ":executeMutation"),
        headers={
            "X-FireBase-Auth-Token": id_token,
            "Content-Type": "application/json",
        },
        json={
            "operationName": "UpdatePrice",
            "variables": {
                "priceRecordId": price_record_id,
                "price": price,
            },
        },
        timeout=15,
    )

    response.raise_for_status()

    result = response.json()

    if result.get("errors"):
        error = result["errors"][0]

        raise DataConnectError(
            message=error.get("message", "Price update failed"),
            code=error.get("extensions", {}).get("code", "UNKNOWN"),
        )

    return result.get("data", {})
