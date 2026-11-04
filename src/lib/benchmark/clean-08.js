logger.info("auth.login", { userRef: sha256(userId).slice(0, 12) });
const DEBUG = process.env.DEBUG === "true";
