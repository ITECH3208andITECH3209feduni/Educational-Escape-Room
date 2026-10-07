const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const database = require('../db/database');
process.env.NODE_ENV = 'test';
process.env.APP_BASE_PATH = '/FEDEscape';
// Never load a user's .env or connect to a production database in these tests.
database.getDatabase = () => db;
const db = require('./memory-database')();
const User = require('../models/User');
const { hash, ensureSecurityIndexes } = require('../middleware/session');
const { ipKey } = require('../middleware/rateLimit');

test('authentication security regressions', async t => {
  const server = require('../server').listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  process.env.CLIENT_URL = origin + '/FEDEscape';
  const base = origin + '/FEDEscape/api';
  const password = 'Isolated-test-password-123';
  const user = await User.create({ name: 'Security Test', email: 'security@example.invalid',
    password: await bcrypt.hash(password, 4), emailVerified: true });
  await ensureSecurityIndexes();
  async function send(method, path, body, jar = {}, extra = {}) {
    const response = await fetch(base + path, { method, headers: {
      'Content-Type': 'application/json', Origin: origin,
      ...(jar.cookie ? { Cookie: jar.cookie } : {}), ...(jar.csrf ? { 'X-CSRF-Token': jar.csrf } : {}), ...extra
    }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { response, data: await response.json() };
  }
  async function anonymous() {
    const { response, data } = await send('GET', '/auth/csrf');
    assert.equal(response.status, 200);
    return { cookie: response.headers.getSetCookie().at(-1).split(';')[0], csrf: data.csrfToken };
  }
  async function login(pw = password) {
    const jar = await anonymous();
    const before = { ...jar };
    const { response, data } = await send('POST', '/auth/login', { email: user.email, password: pw }, jar);
    assert.equal(response.status, 200, JSON.stringify(data));
    assert(!data.token);
    jar.cookie = response.headers.getSetCookie().at(-1).split(';')[0];
    jar.csrf = data.csrfToken;
    return { jar, before, response, data };
  }
  async function resetLimits() { await db.collection('security_rate_limits').deleteMany({}); }

  await t.test('anonymous requests need CSRF, cross-origin requests fail, login rotates session', async () => {
    assert.equal((await send('POST','/auth/login',{email:user.email,password})).response.status,403);
    const jar = await anonymous();
    assert.equal((await send('POST','/auth/login',{email:user.email,password},jar,{Origin:'https://attacker.invalid'})).response.status,403);
    assert.equal((await send('POST','/auth/login',{email:user.email,password},jar,{'Sec-Fetch-Site':'cross-site'})).response.status,403);
    const result = await login();
    assert.notEqual(result.jar.cookie,result.before.cookie);
    assert.notEqual(result.jar.csrf,result.before.csrf);
    assert.match(result.response.headers.get('set-cookie'),/HttpOnly/);
    assert.match(result.response.headers.get('set-cookie'),/SameSite=Lax/);
    assert.match(result.response.headers.get('set-cookie'),/Path=\/FEDEscape/);
    assert(!result.response.headers.get('set-cookie').includes('Secure;'));
    const raw = result.jar.cookie.split('=')[1];
    const stored = await db.collection('security_sessions').findOne({_id:hash(raw)});
    assert(stored); assert.equal(await db.collection('security_sessions').findOne({_id:raw}),null);
    assert.equal((await send('GET','/auth/me',undefined,result.jar)).response.status,200);
    assert.equal((await send('GET','/auth/me',undefined,result.before)).response.status,401);
    assert.equal((await send('PATCH','/auth/profile',{name:'Blocked'},{cookie:result.jar.cookie})).response.status,403);
    const me=(await send('GET','/auth/me',undefined,result.jar)).data.user;
    assert(!Object.hasOwn(me,'sessionVersion')); assert(!Object.hasOwn(me,'password'));
  });
  await t.test('logout revokes the session: replay of a copied cookie is rejected', async () => {
    const {jar}=await login();
    const logout=await send('POST','/auth/logout',{},jar);
    assert.equal(logout.response.status,200);
    assert.match(logout.response.headers.get('set-cookie'),/Expires=Thu, 01 Jan 1970/);
    assert.equal((await send('GET','/auth/me',undefined,jar)).response.status,401);
  });
  await t.test('idle and absolute expiration are enforced without waiting for TTL cleanup', async () => {
    for (const field of ['expiresAt','absoluteExpiresAt']) {
      const {jar}=await login();
      const _id=hash(jar.cookie.split('=')[1]);
      await db.collection('security_sessions').updateOne({_id},{$set:{[field]:new Date(Date.now()-1000)}});
      assert.equal((await send('GET','/auth/me',undefined,jar)).response.status,401);
    }
  });
  await t.test('password changes invalidate sessions on all devices, and old JWTs are refused', async () => {
    const first=(await login()).jar,second=(await login()).jar;
    const changed=await send('PATCH','/auth/change-password',{currentPassword:password,newPassword:'Changed-123'},first);
    assert.equal(changed.response.status,200);
    for(const jar of [first,second]) assert.equal((await send('GET','/auth/me',undefined,jar)).response.status,401);
    // Construct an old-style, correctly signed JWT. The new server accepts no bearer JWTs.
    const head=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
    const payload=Buffer.from(JSON.stringify({id:String(user._id),role:'student',exp:Math.floor(Date.now()/1000)+86400})).toString('base64url');
    process.env.JWT_SECRET='legacy-test-secret';
    const signature=crypto.createHmac('sha256',process.env.JWT_SECRET).update(`${head}.${payload}`).digest('base64url');
    assert.equal((await send('GET','/auth/me',undefined,{}, {Authorization:`Bearer ${head}.${payload}.${signature}`})).response.status,401);
    const next=(await login('Changed-123')).jar;
    const token='test-only-reset-token';
    const account=await User.findById(user._id);
    account.passwordResetToken=hash(token);account.passwordResetExpires=Date.now()+60000;await account.save();
    assert.equal((await send('POST',`/auth/reset-password/${token}`,{password:'Reset-123'},await anonymous())).response.status,200);
    assert.equal((await send('GET','/auth/me',undefined,next)).response.status,401);
    assert.equal((await send('POST',`/auth/reset-password/${token}`,{password:'Again-123'},await anonymous())).response.status,400);
    await login('Reset-123');
  });
  await t.test('all requested endpoints rate-limit, including accounts and reset-token guesses', async () => {
    const cases=[
      ['/auth/login',{email:'unknown@example.invalid',password:'invalid'},15],
      ['/auth/register',{email:'unknown@example.invalid'},3],
      ['/auth/forgot-password',{email:'unknown@example.invalid'},3],
      ['/auth/reset-password/not-a-token',{password:'Invalid-123'},5]
    ];
    for(const [path,body,limit] of cases) {
      await resetLimits(); const jar=await anonymous();
      for(let i=0;i<limit;i++) {
        const attemptBody={...body};
        if(body.email) attemptBody.email=i%2 ? '  UNKNOWN@EXAMPLE.INVALID  ' : body.email;
        if(path.includes('/reset-password/')) attemptBody.email=`unrelated-${i}@example.invalid`;
        assert.notEqual((await send('POST',path,attemptBody,jar)).response.status,429,path);
      }
      const blocked=await send('POST',path,body,jar);
      assert.equal(blocked.response.status,429,path);assert(Number(blocked.response.headers.get('retry-after'))>0);
    }
  });
  await t.test('IP limits survive new sessions and cannot be bypassed with forged X-Forwarded-For', async () => {
    await resetLimits();
    for(let i=0;i<11;i++) {
      const jar=await anonymous();
      const {response}=await send('POST','/auth/register',{email:`${i}@example.invalid`},jar,{'X-Forwarded-For':`198.51.100.${i}`});
      assert.equal(response.status,i<10?400:429);
    }
    assert.equal(ipKey('2001:db8:abcd:1234::1'),ipKey('2001:db8:abcd:1234::ffff'));
    assert.equal(ipKey('::ffff:192.0.2.1'),ipKey('192.0.2.1'));
  });
  await t.test('concurrent attempts cannot lose rate-limit increments', async () => {
    await resetLimits();const jar=await anonymous();
    const results=await Promise.all(Array.from({length:25},()=>send('POST','/auth/login',{email:'parallel@example.invalid',password:'invalid'},jar)));
    assert(results.filter(r=>r.response.status!==429).length<=15);
    assert(results.some(r=>r.response.status===429));
  });
  await t.test('production cookie flags and security headers, local HTTP remains usable', async () => {
    await resetLimits();process.env.NODE_ENV='production';
    try {
      const {response}=await send('GET','/auth/csrf');
      assert.match(response.headers.get('set-cookie'),/__Secure-fedescape_sid=.*; Path=\/FEDEscape;.*HttpOnly; Secure; SameSite=Lax/);
      assert.equal(response.headers.get('strict-transport-security'),'max-age=31536000');
      assert.equal(response.headers.get('x-frame-options'),'DENY');
      assert.equal(response.headers.get('x-content-type-options'),'nosniff');
      assert.equal(response.headers.get('cache-control'),'no-store');
      assert.match(response.headers.get('content-security-policy'),/script-src 'self'; script-src-attr 'none'/);
      assert.match(response.headers.get('content-security-policy'),/upgrade-insecure-requests/);
      assert(!response.headers.has('x-powered-by'));
    } finally { process.env.NODE_ENV='test'; }
    const {response}=await send('GET','/auth/csrf');
    assert(!response.headers.has('strict-transport-security'));
    assert(!response.headers.get('content-security-policy').includes('upgrade-insecure-requests'));
  });
});
