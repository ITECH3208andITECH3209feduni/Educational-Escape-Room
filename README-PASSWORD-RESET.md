# Password recovery — FEDEscape — 7 October 2026

This complete client/server ZIP includes the security fixes from the previous
package and adds password recovery. Keep a backup before replacing local files.
No database, credentials, deployment or GitHub branch was changed here.

## What the user sees

Login -> Forgot password? -> enter registered email -> receive reset email ->
open link -> enter and confirm new password -> log in with the new password.

Both verified student and educator accounts can use recovery. Unverified,
unknown, inactive and suspended accounts receive the same generic response but
no recovery email. Email verification and account status are not bypassed.

The reset email link expires in 15 minutes and works once. A newer reset email
invalidates earlier links. Changing the password signs out all existing sessions.
A separate confirmation email tells the user the password was changed; it never
contains their password. Recovery does not automatically log the user in.

## Install and try it locally

1. Stop Node with Ctrl+C. Extract the new ZIP into a separate folder.
2. Copy your existing private .env into its server folder. Keep your working
   MongoDB and email settings. For local use, CLIENT_URL=http://localhost:5000,
   NODE_ENV=development, APP_BASE_PATH= (empty), and TRUST_PROXY= (empty).
3. Inside the NEW server folder, run:

   npm.cmd ci
   npm.cmd test
   npm.cmd run start:local

4. Open http://localhost:5000/login.html. Use Forgot password? with an existing
   verified test account. Check your inbox/spam and open the emailed link.
5. Enter matching new passwords and submit. Log in with the new password; the
   old password must fail. Reopen the same link and try again: it must fail.
6. Repeat with the other role, then check an existing room/result still works.

The Node process starts the mail worker automatically; there is no extra command
or frontend server. A request is normally picked up within five seconds, plus
SMTP delivery time. The on-screen message confirms that a request was accepted,
not that the mail has already arrived. No real recovery emails were sent here.

## Security and implementation

- The forgot-password response waits only for a durable MongoDB queue insertion.
  Known and unknown addresses take the same path before the generic response.
  Account lookup/SMTP run in the worker, outside the public response timing.
- Existing CSRF checks, per-IP/per-account rate limits and security headers remain.
- A random 256-bit reset token is generated only when a queued message is handled.
  Only its SHA-256 hash is stored on the user, alongside a 15-minute expiry.
- The emailed page URL carries the token in a fragment (#token=...), which is
  removed from the address bar on page load and retained only in JS memory.
  Reloading the page requires reopening the original email. The page has
  no-referrer protection and the existing CSP. Reset-page GETs never consume a
  token, so opening/scanning the email alone cannot change a password.
- Reset URLs are built from CLIENT_URL, never from client-supplied Host headers.
  HTTPS is required for these links in production. The reset API retains the
  existing /api/auth/reset-password/:token route: the university proxy should
  redact that token-bearing path from request logs and avoid request-body logs.
- Passwords are checked twice in the UI, hashed with bcrypt, and limited to the
  existing minimum of six characters and bcrypt's 72-byte input limit. A long,
  unique passphrase is encouraged. Passwords and raw tokens are not logged.
- An atomic MongoDB update consumes the token together with the new password
  and sessionVersion. Parallel requests cannot both reuse it. Password changes,
  newer tokens and account suspension also prevent stale-token reuse.
- The frontend clears old login hints and sends the user to the usual login flow.
  Existing user/room/attempt IDs and results are retained.

## Email worker details for Evan

server/utils/passwordResetQueue.js uses auth_email_jobs in the existing MongoDB.
The Mongo account needs read/write/delete and index-creation permissions for this
collection in addition to the existing collections. Startup creates a queue
lookup index and an expiresAt TTL index. There are no new npm dependencies or
environment secrets. Gmail/local Postfix settings are reused from emailService.js.

Pending requests for the same email are coalesced. Workers claim jobs atomically
with two-minute leases, so jobs survive Node restarts and can be handled by
multiple workers. Each worker polls every five seconds. Failed delivery retries
after one then two minutes, with at most three claims; expired jobs are discarded
after one hour. Explicit SMTP failures clear only that attempt's token, never a
newer token. After a failure/restart, a retry generates a new link.

Delivery is at-least-once: if Node stops just after SMTP accepts a message, retry
may send another email. Use the newest valid link. Pending jobs contain the email
address and operational metadata, not a password or raw reset token. Completed
jobs are deleted. Keep database access restricted as for the users collection.

SMTP timeouts are bounded for connection, greeting and socket inactivity. Monitor
server logs for 'Password recovery email delivery failed' or 'worker unavailable'.
If all retries fail, restore SMTP and request a fresh link. The public page
intentionally does not reveal whether a particular account or delivery exists.

## Validation

35 automated checks passed, including the earlier security/gameplay regression
checks and new recovery checks: student/educator success, old-password rejection,
all-session invalidation, hashed storage, correct configured URL, escaped email
names, unknown-account parity, verification/status restrictions, token expiry,
newer-link invalidation, single use/concurrent consumption, SMTP failures/retries,
coalescing, queue leases/restart recovery, and frontend validation/progress/errors.

Automated tests use a MongoDB substitute and stub SMTP by default. They do not
prove actual inbox delivery, live MongoDB or browser/proxy compatibility. Those
must be checked on your laptop and university HTTPS deployment before release.
The earlier Chromium download failed, so no browser visual pass is claimed.

For an isolated live MongoDB test, set TEST_MONGO_URI as explained in
README-SECURITY.md. The migration and new password-recovery suites then create
and drop their own uniquely named test databases; email stays stubbed.

## Changes from the preceding security package

New: client/forgot-password.html, client/reset-password.html,
client/js/password-recovery.js, server/utils/passwordResetQueue.js,
server/test/password-reset.test.js, server/test/password-recovery-ui.test.js.

Updated: client/login.html, client/js/session.js, server/server.js,
server/controllers/authController.js, server/utils/emailService.js,
server/test/memory-database.js, server/.env.example and the guides.

Security design reference:
https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html
