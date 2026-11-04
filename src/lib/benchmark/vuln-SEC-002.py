def get_user(name):
    query = "SELECT * FROM users WHERE name = '" + name + "'"
    return db.execute(query)
