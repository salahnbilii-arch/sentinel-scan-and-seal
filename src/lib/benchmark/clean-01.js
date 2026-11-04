const key = process.env["API_KEY"];
export const handler = async (id) => db.query("SELECT * FROM users WHERE id = $1", [id]);
