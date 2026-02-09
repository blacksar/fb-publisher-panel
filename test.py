import requests
import base64

MEDIA_API_KEY = "9QpXJCBuGCnV1m7Az0ZkCQHMt"
BASE_URL = "http://localhost:3000"

headers = {
    "X-API-Key": MEDIA_API_KEY,
    "Content-Type": "application/json",
}

with open("image.png", "rb") as f:
    b64 = base64.b64encode(f.read()).decode()

r = requests.post(
    f"{BASE_URL}/api/media/upload-base64",
    headers=headers,
    json={"imageBase64": b64},
)
data = r.json()
if data.get("status") == "ok":
    print("URL de la imagen:", data)