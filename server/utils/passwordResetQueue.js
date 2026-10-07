// Durable email jobs keep SMTP delays/account lookup out of the public response.
// Neither raw reset tokens nor passwords are persisted in this queue.
const database = require("../db/database");
const User = require("../models/User");
const { hash, random } = require("../middleware/session");
const emailService = require("./emailService");
const jobs = () => database.getDatabase().collection("auth_email_jobs");
const expiry = () => new Date(Date.now() + 60 * 60 * 1000);
async function enqueueReset(email) {
  const now = new Date();
  // Coalesce requests for an email while a delivery is already pending.
  // Unknown accounts take the same insert path and receive the same HTTP response.
  const _id = hash("reset:" + email);
  try {
    await jobs().updateOne({ _id }, { $setOnInsert: {
      kind: "reset", email, createdAt: now, availableAt: now, expiresAt: expiry(), attempts: 0
    } }, { upsert: true });
  } catch (error) { if (error.code !== 11000) throw error; }
}
async function enqueueChanged(user) {
  const now = new Date();
  await jobs().insertOne({ _id: random(), kind: "changed", email: user.email, name: user.name,
    createdAt: now, availableAt: now, expiresAt: expiry(), attempts: 0 });
}
async function processNext() {
  const now = new Date();
  const leaseId = random();
  const job = await jobs().findOneAndUpdate({ availableAt: { $lte: now } }, {
    $set: { availableAt: new Date(+now + 120000), leaseId }, $inc: { attempts: 1 }
  }, { returnDocument: "after", sort: { createdAt: 1 } });
  if (!job) return false;
  const claim = { _id: job._id, leaseId };
  let tokenHash, user;
  try {
    if (+job.expiresAt <= Date.now() || job.attempts > 3) {
      await jobs().deleteOne(claim); return true;
    }
    if (job.kind === "changed") {
      await emailService.sendPasswordChangedEmail(job.email, job.name);
    } else {
      user = await User.findOne({ email: job.email });
      // Recovery does not bypass email verification or reactivate suspended accounts.
      if (!user || !user.emailVerified || user.accountStatus !== "active") {
        await jobs().deleteOne(claim); return true;
      }
      const token = random();
      tokenHash = hash(token);
      user.passwordResetToken = tokenHash;
      user.passwordResetExpires = Date.now() + 15 * 60 * 1000;
      await user.save();
      const delivery = await emailService.sendPasswordResetEmail(user.email, user.name, token);
      if (!delivery.accepted?.length) {
        const error = new Error("SMTP did not accept the recipient"); error.code = "EDELIVERY"; throw error;
      }
    }
    await jobs().deleteOne(claim);
  } catch (error) {
    // Do not log recipients, SMTP responses, reset URLs or credentials.
    console.error("Password recovery email delivery failed:", error.code || error.name || "Error");
    if (tokenHash && user) {
      await User.collection().updateOne({ _id: user._id, passwordResetToken: tokenHash }, {
        $set: { passwordResetToken: null, passwordResetExpires: null }, $inc: { __v: 1 }
      });
    }
    if (job.attempts >= 3) await jobs().deleteOne(claim);
    else await jobs().updateOne(claim, { $set: { availableAt: new Date(Date.now() + job.attempts * 60000) } });
  }
  return true;
}
async function ensureIndexes() {
  await jobs().createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await jobs().createIndex({ availableAt: 1, createdAt: 1 });
}
let timer, running;
function start() {
  if (timer) return;
  const tick = () => {
    if (running) return;
    running = (async () => { for (let i = 0; i < 10 && await processNext(); i++); })()
      .catch(error => console.error("Password recovery worker unavailable:", error.code || error.name || "Error"))
      .finally(() => { running = null; });
  };
  timer = setInterval(tick, 5000);
  timer.unref();
  tick();
}
async function stop() { clearInterval(timer); timer = null; if (running) await running; }
module.exports = { enqueueReset, enqueueChanged, processNext, ensureIndexes, start, stop };
