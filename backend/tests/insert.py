import json
import math
import sys
from pathlib import Path

import google.auth
from google.auth.transport.requests import AuthorizedSession


backend = Path(__file__).resolve().parents[1]
mutation_file = backend / "dataconnect/endpoint/mutations.gql"

item_name = input("Item name: ").strip()
brand = input("Brand (optional): ").strip()
sys.path.insert(0, str(backend))
from app.schemas.item import GroceryUnit

amount_text = input("Unit amount (optional, e.g. 1.5): ").strip()
unit_amount = None
unit = None
if amount_text:
    try:
        unit_amount = float(amount_text)
    except ValueError:
        raise SystemExit("Unit amount must be a positive number.")
    if not math.isfinite(unit_amount) or unit_amount <= 0:
        raise SystemExit("Unit amount must be a finite positive number.")
    units = list(GroceryUnit)
    for index, choice in enumerate(units, start=1):
        print(f"{index}. {choice.value}")
    try:
        selection = int(input("Select unit number: ").strip())
    except ValueError:
        raise SystemExit("Select a unit by its number.")
    if not 1 <= selection <= len(units):
        raise SystemExit("Invalid unit selection.")
    unit = units[selection - 1].value

if not item_name:
    raise SystemExit("Item name is required.")

credentials, _ = google.auth.default(
    scopes=["https://www.googleapis.com/auth/cloud-platform"]
)

url = (
    "https://firebasedataconnect.googleapis.com/v1/"
    "projects/grocerypricepal/"
    "locations/us-east4/"
    "services/grocerypricepal-service:executeGraphql"
)

with AuthorizedSession(credentials) as session:
    response = session.post(
        url,
        json={
            "query": mutation_file.read_text(),
            "operationName": "CreateItem",
            "variables": {
                "itemName": item_name,
                "brand": brand or None,
                "unitAmount": unit_amount,
                "unit": unit,
            },
        },
        timeout=30,
    )

try:
    result = response.json()
except ValueError:
    print(response.text)
    raise SystemExit(f"Request failed: HTTP {response.status_code}")

if not response.ok or result.get("errors"):
    print("HTTP status:", response.status_code)
    print(json.dumps(result, indent=2))
    raise SystemExit(1)

print("\nItem saved successfully:")
print(json.dumps(result["data"], indent=2))