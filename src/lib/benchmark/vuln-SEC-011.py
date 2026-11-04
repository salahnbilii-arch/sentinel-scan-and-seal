@app.post("/api/orders")
async def create_order(payload: Order):
    return await save(payload)
