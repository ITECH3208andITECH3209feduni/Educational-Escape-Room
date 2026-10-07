const crypto = require("node:crypto");
const database = require("../db/database");
const hash = value => crypto.createHash("sha256").update(value).digest("hex");
const random = () => crypto.randomBytes(32).toString("hex");
const production = () => process.env.NODE_ENV === "production";
const cookieName = () => production() ? "__Secure-fedescape_sid" : "fedescape_sid";
const cookieOptions = () => ({ httpOnly: true, secure: production(), sameSite: "lax",
  path: (process.env.APP_BASE_PATH || "").replace(/\/+$/, "") || "/" });
const sessions = () => database.getDatabase().collection("security_sessions");
const ABSOLUTE_MS = 8 * 60 * 60 * 1000;
const IDLE_MS = 30 * 60 * 1000;
const ANONYMOUS_MS = 15 * 60 * 1000;

async function destroySession(req, res) {
  if (req.session) await sessions().deleteOne({ _id: req.session._id });
  req.session = null;
  res.clearCookie(cookieName(), cookieOptions());
}
async function createSession(req, res, user) {
  if (req.session) await sessions().deleteOne({ _id: req.session._id });
  const raw = random();
  const now = Date.now();
  const absoluteExpiresAt = new Date(now + (user ? ABSOLUTE_MS : ANONYMOUS_MS));
  const session = { _id: hash(raw), csrfToken: random(), createdAt: new Date(now),
    absoluteExpiresAt, expiresAt: new Date(Math.min(+absoluteExpiresAt, now + IDLE_MS)),
    userId: user ? user._id : null, sessionVersion: user ? (user.sessionVersion || "") : null };
  await sessions().insertOne(session);
  req.session = session;
  res.cookie(cookieName(), raw, { ...cookieOptions(), maxAge: +absoluteExpiresAt - now });
  return session;
}
async function loadSession(req, res, next) {
  const cookie = (req.headers.cookie || "").split(";").map(s => s.trim())
    .find(s => s.startsWith(cookieName() + "="));
  if (cookie) {
    const raw = cookie.slice(cookie.indexOf("=") + 1);
    if (/^[a-f0-9]{64}$/.test(raw)) {
      req.session = await sessions().findOne({ _id: hash(raw) });
      if (req.session && (+req.session.expiresAt <= Date.now() || +req.session.absoluteExpiresAt <= Date.now())) {
        await destroySession(req, res);
      }
    }
  }
  next();
}
async function csrfToken(req, res) {
  if (!req.session) await createSession(req, res);
  res.json({ success: true, csrfToken: req.session.csrfToken });
}
function csrfProtection(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const supplied = req.get("X-CSRF-Token") || "";
  const expected = req.session?.csrfToken || "";
  // A same-origin token fetched by JS is required even for anonymous login/register.
  if (!/^[a-f0-9]{64}$/.test(supplied) || !expected ||
      !crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) {
    return res.status(403).json({ success: false, code: "CSRF_INVALID", message: "Your security session expired. Please try again." });
  }
  next();
}
async function touchSession(req) {
  await sessions().updateOne({ _id: req.session._id }, { $set: {
    expiresAt: new Date(Math.min(+req.session.absoluteExpiresAt, Date.now() + IDLE_MS))
  } });
}
async function ensureSecurityIndexes() {
  await sessions().createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await database.getDatabase().collection("security_rate_limits").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
}
module.exports = { hash, random, loadSession, csrfToken, csrfProtection, createSession,
  destroySession, touchSession, ensureSecurityIndexes };
