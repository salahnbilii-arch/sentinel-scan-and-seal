@app.post("/api/orders")
async def create_order(payload: Order, user: User = Depends(require_auth)):
    return await save(payload, user)
