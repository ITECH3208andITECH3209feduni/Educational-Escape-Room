# FEDEscape security update — 7 October 2026

This package includes the security update AND the completed password-reset flow.
See README-PASSWORD-RESET.md for the recovery feature and its acceptance checks.

This is a separate updated copy of the latest combined client/server package.
Deploy both folders together. Keep your existing project as a backup. No live
database, university deployment or email account was modified here.

## Run it on your laptop

1. Stop the running Node server with Ctrl+C and extract this ZIP into a new folder.
2. Copy your existing private server/.env into the new server folder. Do not copy
   old node_modules. Do not commit or email private credentials in this ZIP.
3. For local testing, use NODE_ENV=development, PORT=5000, APP_BASE_PATH= (empty),
   CLIENT_URL=http://localhost:5000 and TRUST_PROXY= (empty). Keep your existing
   MongoDB and Gmail settings. JWT_SECRET/JWT_EXPIRES_IN/FRONTEND_URL may be removed;
   the new server does not use them.
4. In the VS Code terminal, inside the NEW server folder, run:

   npm.cmd ci
   npm.cmd test
   npm.cmd run start:local

5. Open http://localhost:5000 and sign in again. Do not use Live Server on port
   5500: the Node process now serves both frontend and API on the same origin.
   If system CA support is not needed, npm.cmd start also works.

Node must support the locked dependencies (at least 20.19.0). The existing
start:local command uses --use-system-ca; your previously used Node 24 supports
it. The server/test folder stays inside server. It is development verification
code, not an additional service to run, and is never served to visitors.

## What changed for Evan's three findings

### 1. Brute-force protection

MongoDB-backed fixed-window limits are enforced before the authentication
handlers. Responses use HTTP 429 with Retry-After. Counts include unsuccessful
and successful calls. They persist across restarts and are shared by workers.
There is no permissive memory fallback if MongoDB is unavailable.

| Endpoint | Per client IP | Per normalized email or reset token | Window |
| --- | --- | --- | --- |
| POST /api/auth/login | 60 | 15 per email | 15 minutes |
| POST /api/auth/register | 10 | 3 per email | 1 hour |
| POST /api/auth/forgot-password | 10 | 3 per email | 15 minutes |
| POST /api/auth/reset-password/:token | 10 | 5 per token | 15 minutes |
| PATCH /api/auth/change-password | 10 | — | 15 minutes |
| GET /api/auth/csrf | 100 | — | 15 minutes |
| GET /api/auth/verify-email/:token | 60 | — | 15 minutes |

IPv6 clients are grouped by /64. IPv4-mapped IPv6 is normalized. Stored rate-limit
keys are SHA-256 hashes, not plaintext email/IP values. New windows work even if
MongoDB TTL cleanup has not run. Fixed windows allow boundary bursts, as expected.
Limits are defined in server/routes/authRoutes.js. Evan should assess them against
expected classroom traffic: users behind a NAT share the IP allowance. Account
limits remain independent of IP, so changing IP does not reset that allowance.

### 2. Security response headers

middleware/securityHeaders.js supplies explicit headers equivalent to the relevant
Helmet protections, without adding Helmet as a dependency:

- Content-Security-Policy: same-origin scripts/API calls; inline executable scripts
  and event attributes blocked; object-src none; frame-ancestors none; same-origin
  forms/base URLs; narrowly allowed Google font and YouTube frame hosts.
- X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy no-referrer,
  Cross-Origin-Opener-Policy same-origin, Cross-Origin-Resource-Policy same-origin,
  Permissions-Policy disabling camera/microphone/geolocation, and additional
  legacy cross-domain/DNS-prefetch restrictions. X-Powered-By is removed.
- Production: HSTS max-age=31536000 and CSP upgrade-insecure-requests. These are
  disabled for local development HTTP. HSTS does not include unrelated subdomains.
- API/config responses are no-store. Existing inline styles remain allowed for
  layout compatibility; inline JavaScript and eval do not. HTTPS image/media
  sources are allowed for educator-provided question media.

The room intro script was moved into js/intro.js. Educator navigation, room actions
and retry buttons now use event listeners instead of inline onclick attributes.
The obsolete login-page claim that any credentials work was corrected.

### 3. Safer sessions and revocation

The app no longer issues or accepts bearer JWTs. The jsonwebtoken dependency is
removed. Authentication uses an opaque, random 256-bit session ID, carried only
in an HttpOnly, SameSite=Lax cookie. Production adds Secure and uses the
__Secure-fedescape_sid name; the cookie is host-only and scoped to APP_BASE_PATH.
Only SHA-256 hashes of session IDs are stored in MongoDB.

Authenticated sessions have an 8-hour absolute lifetime and 30-minute idle timeout.
Protected API activity extends idle expiry, never absolute expiry. Anonymous
pre-login sessions last 15 minutes. Expiry is checked on every API request, not
left to the database cleanup timer. Login rotates the session and CSRF token.

Logout deletes the server record before the UI redirects. Password changes and
resets atomically change a hidden per-user sessionVersion together with the
password. Every protected request compares that version, so other devices lose
access immediately on their next request. Old password-reset links are also
cleared on password change. Existing signed JWTs no longer authorize anything.

All POST/PUT/PATCH/DELETE API calls require a synchronizer CSRF token from
GET /api/auth/csrf, including registration and login. The token is tied to the
server session and compared in constant time. Cross-origin writes are rejected;
credentialed cross-origin CORS is not enabled. The shared frontend session client
handles CSRF renewal and cookies. It retries a write only after middleware has
explicitly rejected it for an invalid CSRF token before executing the action.

Old localStorage JWTs are cleared. localStorage still holds non-secret UI hints
such as name/role and game state; those do not authorize backend actions. All
users must sign in again after this release. HttpOnly/CSP reduce credential theft
risk; they do not mean that arbitrary XSS would be harmless.

## University configuration and deployment

Use server/.env.example as the revised university template. It contains no private
passwords. CLIENT_URL must match the final public URL used by students and the
verification emails, including the application prefix. The example URL still
needs Evan's confirmation.

1. Install with npm ci through the approved university registry; do not upload
   node_modules or bypass quarantines. mongoose/sift remain absent. ipaddr.js
   1.9.1 is now direct for IPv6 rate-limit normalization; it was already in the
   Express dependency tree. jsonwebtoken and cors have been removed.
2. NODE_ENV must be production behind a working HTTPS reverse proxy. Publish
   frontend and API under the same origin and /FEDEscape prefix. Forward that
   prefix unchanged to Node. If the proxy currently strips it, coordinate the
   proxy mapping before deployment; do not expose the server directory as files.
3. Set TRUST_PROXY only to the actual trusted proxy IPs/CIDRs. If the proxy is on
   the same machine, loopback is appropriate. Otherwise specify its exact address
   or narrow CIDR, not true, a hop count, or the whole client network. Configure
   the proxy to replace/append forwarding headers correctly and restrict direct
   network access to Node. With TRUST_PROXY empty, Express safely ignores forged
   forwarding headers, but proxied users will share the proxy IP allowance.
4. Forward Set-Cookie and the security headers unchanged, preserve HTTPS, and do
   not cache API responses. Production cookies intentionally do not work over
   plain HTTP. For the public URL, use HTTPS on the first visit as well.
5. The Mongo account needs index creation and read/write/delete access to the
   new security_sessions, security_rate_limits and auth_email_jobs collections. Startup creates
   expiry TTL indexes (expireAfterSeconds: 0). Session versions are populated
   lazily on password changes; existing user records need no manual migration.
6. Keep the existing process/service manager restarting Node automatically and
   test /FEDEscape/api/health plus the flows below from the university URL.

## Verification completed here

35 automated checks passed (including suite parent checks), covering:

- Existing registration/email-verification/login, profile, hidden-field retention,
  room creation/publishing/ownership, attempts/scoring/results and leaderboards.
- Session cookie attributes, hashed storage, login rotation, idle/absolute expiry,
  copied-cookie replay after logout, password-change/reset invalidation across
  devices, and rejection of correctly signed legacy bearer JWTs.
- CSRF rejection, cross-origin rejection, limits on all four requested endpoints,
  normalized account keys, new-session/IP spoof attempts and concurrent counters.
- Production/local header behavior, prefixed serving and private-file exclusion.
- Frontend CSRF renewal, cookie request options, logout failure handling, removal
  of old localStorage credentials, script presence/order and CSP compatibility
  checks for inline handlers/scripts. Registration progress feedback remains.

npm audit --omit=dev reported zero known vulnerabilities on 7 October 2026. This
is a point-in-time public advisory check, not university policy approval.

Tests use an in-memory Mongo collection substitute and stub email delivery. A
real MongoDB server could not start in this environment during earlier work.
A Chromium browser download also failed, so no real-browser visual/end-to-end
pass is claimed. These checks do not certify live MongoDB, SMTP, the university
proxy, or a clean external security scan. Evan should rerun his security review.

## Before asking Evan to deploy

On your laptop, verify registration and the actual emailed verification link,
student/educator login, room creation/edit/publish, the intro and gameplay,
results/progress/leaderboards, and logout. Then repeat the essential flows at the
HTTPS university URL. Check browser Console for CSP errors and confirm the Network
panel shows the headers, no-store on API responses, and no bearer Authorization.

With two logged-in browser profiles, change/reset a password via the API and
confirm both old sessions fail at /api/auth/me. Replay a saved session cookie
after logout in an isolated test and expect 401. Use test accounts for rate-limit
checks; repeated legitimate attempts count toward the limits too.

To run the existing API regression suite against a real isolated local/test
MongoDB server (never a production URI), inside server in PowerShell:

   $env:TEST_MONGO_URI = "mongodb://127.0.0.1:27017"
   npm.cmd test
   Remove-Item Env:TEST_MONGO_URI

That mode creates/drops a uniquely named fedescape_test_* database for the
migration and password-recovery regression suites. Security-specific tests still
use the substitute.
Outbound email is stubbed in automated tests. No tests use the real email login.

## Password recovery

The previous unfinished forgot-password handler has now been replaced with the
complete request/email/reset flow. See README-PASSWORD-RESET.md. Email delivery
uses the existing SMTP configuration; no new package or private key is required.
