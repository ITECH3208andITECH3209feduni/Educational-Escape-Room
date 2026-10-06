# FEDEscape native MongoDB backend — 5 October 2026

This is a separate converted copy of the supplied server.zip. It removes the
Mongoose and sift dependencies and uses the official mongodb driver, pinned to
7.5.0. Node.js 20.19.0 or newer is required. The original ZIP is unchanged.

## Install on your computer first (Windows / VS Code)

1. Stop the running backend with Ctrl+C.
2. Keep a backup of your current server folder, including your private .env.
3. Extract this ZIP into a separate folder. It contains a server folder.
4. Copy your existing .env into this new server folder. Do not upload or commit it.
5. Open a terminal inside the NEW server folder and run:

   node -v
   npm ci
   npm test
   npm ls mongoose sift
   npm start

`npm ls mongoose sift` should show `(empty)`; npm may return a nonzero exit code
because neither package exists. This is expected. Do not copy the old
node_modules folder into this new folder.

Open http://localhost:5000/api/health (or your configured port). The database
field must say connected. Keep the existing frontend running in the usual way.

## Database and frontend compatibility

The collections remain users, rooms and attempts. Existing ObjectIds, question
IDs, dates, password hashes and reference fields are retained. No bulk data
migration or collection deletion is performed. Use the SAME database name in
MONGO_URI as before. An optional MONGO_DB_NAME explicitly overrides the URI's
name; leave it unset unless needed. A URI without a database uses test.

Routes and controller response shapes are retained. db/model.js is a small,
application-specific persistence layer; its familiar find/save/populate methods
call the native driver's find/findOne/insertOne/updateOne operations. It is not
Mongoose, a renamed package, or a full replacement ODM. It deliberately supports
only the operations this backend uses. Reference population uses batched reads.

The model definitions retain validation rules, defaults, timestamps, question
IDs, indexes, and score/progress calculations. Hidden user fields remain hidden
from normal queries and JSON responses. Updates preserve unselected fields.
Concurrent stale saves are rejected using the existing __v version field rather
than overwriting a newer save; reload and retry if such an error occurs.

Startup ensures existing schema indexes, including unique user emails. If old
data contains duplicate emails or conflicting indexes, startup will report that
error; resolve the data/index conflict before proceeding. Do not drop indexes or
collections blindly. Back up your database before deploying changed code.

No frontend files are included or changed. Existing frontend configuration and
SMTP must still point to addresses reachable by the people testing the app.
CLIENT_URL controls the verification link; FRONTEND_URL controls production
CORS. A localhost verification link only works on the computer hosting that
frontend. This migration does not resolve a wrong frontend API URL or network
connectivity by itself.

## What was checked here

- A clean npm ci installation succeeded using the supplied locked dependency
  versions, with mongodb promoted to a direct dependency.
- The installed production dependency tree and lockfile contain neither
  mongoose nor sift. Mongoose-only dependencies were removed; remaining nested
  package entries and integrity hashes were retained.
- Nine node:test checks passed (including the parent workflow check).
- HTTP API regression scenarios cover registration, email verification and
  login for students/educators; profile/password updates; hidden-field
  preservation; room validation, publishing, archival and soft deletion;
  educator ownership; attempt resume, scoring, hints, duplicate answers and
  completion; results, reference population, leaderboards; student result
  isolation; token expiry field casting, password reset; legacy BSON records;
  and stale-save rejection.
- Tests use a test-only in-memory collection substitute by default and stub
  outbound email. No email was sent and no Atlas data was accessed.

A temporary real MongoDB server could not start in the execution environment
(open: Operation not permitted). Consequently these passing checks do NOT prove
live MongoDB integration, real SMTP delivery, frontend/browser compatibility,
or university registry approval. Those gates remain outstanding.

## Run the same suite against a real isolated database

Use a LOCAL or dedicated TEST MongoDB server, never your production URI. The
suite creates and drops only a uniquely named fedescape_test_* database. The test
account needs permission to create indexes and drop that test database. SMTP
remains stubbed even in this mode. In PowerShell, inside server:

   $env:TEST_MONGO_URI = "mongodb://127.0.0.1:27017"
   npm test
   Remove-Item Env:TEST_MONGO_URI

For normal `npm test`, leave TEST_MONGO_URI unset. The test output explicitly
states it is using an in-memory substitute. test/memory-database.js is test-only
and is never used by the running application.

## Browser acceptance checks before university deployment

1. Sign in with an existing verified account; verify its existing rooms/results.
2. Register a new student and educator, receive real emails, follow the links,
   and log in. Confirm the links reach the correct frontend and API.
3. Create/edit/publish a room, play all supported question types, finish it, and
   compare results, leaderboard and educator progress with expected scores.
4. Verify another educator cannot edit the room or read its private results;
   verify a second student cannot read or answer the first student's attempt.
5. Confirm password/profile changes, archival and soft deletion.

## University deployment

Use Evan's university VPN/registry instructions. Run the clean install through
the approved registry and send Evan the revised package.json/package-lock.json
or this source ZIP. Removing sift does not certify any other dependency as
approved; the university's scanner makes that decision. Confirm Node meets the
minimum requirement. Do not bypass quarantines or send local node_modules.

Local Postfix support is preserved in utils/emailService.js. Evan's server can
use EMAIL_HOST=127.0.0.1, EMAIL_PORT=25, EMAIL_SECURE=false,
EMAIL_IGNORE_TLS=true, no EMAIL_USER/EMAIL_PASS, and an approved EMAIL_FROM.
Use the real hosted frontend URL for CLIENT_URL and FRONTEND_URL.

## Existing limitations outside this migration

The supplied forgot-password handler creates a reset token but does not send a
password reset email; this remains unchanged. Published room listing is public
in the supplied routes; this migration does not introduce student assignment
restrictions. Your current scoring/timer rules are retained, not redesigned.

## Files

Added: db/database.js, db/model.js, test/migration.test.js,
test/memory-database.js and this guide.
Changed: server.js, models/User.js, models/Room.js, models/Attempt.js,
controllers/roomController.js, controllers/attemptController.js,
package.json, package-lock.json. authController.js was normalized to LF without
logic changes. Route definitions, authentication middleware and email service
behaviour are retained.
