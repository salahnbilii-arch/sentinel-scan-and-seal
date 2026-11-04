import hashlib, requests
digest = hashlib.sha256(data).hexdigest()
resp = requests.get("https://api.example.com/v1/items", timeout=10)
