import json
from pathlib import Path

import google.auth
from google.auth.transport.requests import AuthorizedSession


backend = Path(__file__).resolve().parents[1]
query_file = backend / "dataconnect/endpoint/queries.gql"

credentials, _ = google.auth.default(
    scopes=["https://www.googleapis.com/auth/cloud-platform"]
)

url = (
    "https://firebasedataconnect.googleapis.com/v1/"
    "projects/grocerypricepal/"
    "locations/us-east4/"
    "services/grocerypricepal-service:executeGraphqlRead"
)

with AuthorizedSession(credentials) as session:
    response = session.post(
        url,
        json={
            "query": query_file.read_text(),
            "operationName": "SearchItems",
            "variables": {"pattern": "chicken%"},
        },
        timeout=30,
    )

print("HTTP status:", response.status_code)

try:
    result = response.json()
except ValueError:
    print(response.text)
    raise SystemExit(1)

print(json.dumps(result, indent=2))

if not response.ok or result.get("errors"):
    raise SystemExit(1)