import json
from pathlib import Path

import google.auth
from google.auth.transport.requests import AuthorizedSession


backend = Path(__file__).resolve().parents[1]
mutation_file = backend / "dataconnect/endpoint/mutations.gql"

item_name = input("Item name: ").strip()
brand = input("Brand (optional): ").strip()
unit_size = input("Unit size (optional, e.g. 1 lb): ").strip()

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
                "unitSize": unit_size or None,
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