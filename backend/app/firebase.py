import firebase_admin
from firebase_admin import credentials, auth
from pathlib import Path

SERVICE_ACCOUNT_PATH = (
    Path(__file__).resolve().parent.parent
    /"firebase-service-account.json"
)

cred = credentials.Certificate(str(SERVICE_ACCOUNT_PATH))

if not firebase_admin._apps:
    firebase_admin.initialize_app(cred)


def verify_firebase_token(token: str):
    """
    Verify a firebase ID token and return the decoded user info.
    """
    return auth.verify_id_token(token)


