DB_HOST = "db.internal"
API_KEY = "sk_live_9f8e7d6c5b4a3210"
def connect():
    return client(DB_HOST, API_KEY)
