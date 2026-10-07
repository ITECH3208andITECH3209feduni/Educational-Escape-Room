const database = require("../db/database");
const { hash } = require("./session");
const ipaddr = require("ipaddr.js");
function ipKey(ip) {
  try {
    const address = ipaddr.process(ip);
    // Group IPv6 privacy addresses by /64 so rotating the host portion cannot bypass the limit.
    return address.kind() === "ipv6" ? address.parts.slice(0, 4).join(":") + "::/64" : address.toString();
  } catch { return "unknown"; }
}
// MongoDB-backed fixed windows work across restarts and multiple Node workers.
// Counters fail closed if storage is unavailable; there is no memory-only fallback.
function rateLimit(name, { ip = 60, account, windowMs = 15 * 60 * 1000 } = {}) {
  return async (req, res, next) => {
    const now = Date.now();
    const bucket = Math.floor(now / windowMs);
    const expiresAt = new Date((bucket + 1) * windowMs);
    const keys = [["ip:" + ipKey(req.ip), ip]];
    const identifier = req.params.token || (typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : null);
    if (account && identifier) keys.push(["account:" + identifier, account]);
    const collection = database.getDatabase().collection("security_rate_limits");
    for (const [key, limit] of keys) {
      const _id = hash(`${process.env.APP_BASE_PATH || "/"}:${name}:${bucket}:${key}`);
      // The _id unique index and atomic $inc prevent lost increments between workers.
      try {
        await collection.updateOne({ _id }, { $inc: { count: 1 }, $setOnInsert: { expiresAt } }, { upsert: true });
      } catch (error) {
        if (error.code !== 11000) throw error;
        await collection.updateOne({ _id }, { $inc: { count: 1 } });
      }
      const counter = await collection.findOne({ _id });
      if (!counter || counter.count > limit) {
        res.set("Retry-After", String(Math.max(1, Math.ceil((+expiresAt - now) / 1000))));
        return res.status(429).json({ success: false, message: "Too many attempts. Please wait and try again." });
      }
    }
    next();
  };
}
module.exports = { rateLimit, ipKey };
