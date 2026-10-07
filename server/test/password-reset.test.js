const { test } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const crypto = require('node:crypto');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const initialPassword = 'Initial-reset-test-123';

test('complete password recovery and email queue', async t => {
  process.env.NODE_ENV = 'test';
  process.env.APP_BASE_PATH = '/FEDEscape';
  process.env.MONGO_DB_NAME = `fedescape_test_reset_${Date.now()}_${process.pid}`;
  process.env.EMAIL_HOST = 'localhost'; process.env.EMAIL_PORT = '25';
  process.env.EMAIL_FROM = 'test@example.invalid';
  const database = require('../db/database');
  if (process.env.TEST_MONGO_URI) await database.connect(process.env.TEST_MONGO_URI);
  else {
    const memory = require('./memory-database')(); database.getDatabase = () => memory;
    database.close = async () => {};
    t.diagnostic('Using the test-only MongoDB substitute; SMTP is stubbed.');
  }
  const db = database.getDatabase();
  const User = require('../models/User');
  const queue = require('../utils/passwordResetQueue');
  await User.ensureIndexes(); await queue.ensureIndexes();
  const mails = []; let failMail = false; let attempts = 0;
  const nodemailer = require('nodemailer'); const original = nodemailer.createTransport;
  nodemailer.createTransport = () => ({ sendMail: async mail => {
    attempts++;
    if (failMail) { const error = new Error('Simulated SMTP failure'); error.code = 'ESMTP'; throw error; }
    mails.push(mail); return { accepted: [mail.to] };
  }});
  const server = require('../server').listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  process.env.CLIENT_URL = origin + '/FEDEscape';
  const base = process.env.CLIENT_URL + '/api';
  t.after(async () => {
    await queue.stop(); await new Promise(resolve => server.close(resolve));
    nodemailer.createTransport = original; await db.dropDatabase(); await database.close();
  });
  let serial = 0;
  async function makeUser(overrides = {}) {
    return User.create({ name: 'Recovery <Test>', email: `recovery${++serial}@example.invalid`,
      password: await bcrypt.hash(initialPassword, 4), emailVerified: true, role: 'student', ...overrides });
  }
  async function anonymous() {
    const response = await fetch(base + '/auth/csrf'); assert.equal(response.status, 200);
    return { cookie: response.headers.getSetCookie().at(-1).split(';')[0], csrf: (await response.json()).csrfToken };
  }
  async function request(path, body, jar, method = 'POST') {
    jar ||= await anonymous();
    const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json',
      Origin: origin, Cookie: jar.cookie, 'X-CSRF-Token': jar.csrf, Host: 'attacker.invalid' },
      body: body === undefined ? undefined : JSON.stringify(body) });
    return { response, data: await response.json() };
  }
  async function login(user, password = initialPassword) {
    const { response, data } = await request('/auth/login', { email: user.email, password });
    assert.equal(response.status, 200, JSON.stringify(data));
    return { cookie: response.headers.getSetCookie().at(-1).split(';')[0], csrf: data.csrfToken };
  }
  async function requestLink(user) {
    const { response } = await request('/auth/forgot-password', { email: user.email });
    assert.equal(response.status, 200);
    await queue.processNext();
    const mail = mails.at(-1); assert.equal(mail.subject, 'Reset your FEDEscape password');
    const token = mail.text.match(/#token=([a-f0-9]{64})/)[1];
    return { token, mail };
  }
  async function clearQueues() {
    await db.collection('auth_email_jobs').deleteMany({});
    await db.collection('security_rate_limits').deleteMany({});
  }
  await t.test('known and unknown accounts receive the same response before SMTP runs', async () => {
    const user = await makeUser(); const start = attempts;
    const known = await request('/auth/forgot-password', { email: user.email.toUpperCase() });
    const unknown = await request('/auth/forgot-password', { email: 'unknown@example.invalid' });
    assert.equal(known.response.status, 200); assert.deepEqual(known.data, unknown.data);
    assert.equal(attempts, start);
    assert.equal(await db.collection('auth_email_jobs').countDocuments({}), 2);
    const stored = await User.collection().findOne({ _id: user._id });
    assert.equal(stored.passwordResetToken, null); // generated only by the worker
    await queue.processNext(); await queue.processNext();
    assert.equal(attempts, start + 1);
    assert.equal(await db.collection('auth_email_jobs').countDocuments({}), 0);
    assert(!JSON.stringify(known.data).includes('token'));
  });
  await t.test('student and educator can reset, old credentials/sessions fail, and no auto-login occurs', async () => {
    for (const role of ['student', 'educator']) {
      await clearQueues();
      const user = await makeUser({ role }); const first = await login(user), second = await login(user);
      const { token, mail } = await requestLink(user);
      assert(mail.text.includes(origin + '/FEDEscape/reset-password.html#token='));
      assert(!mail.text.includes('attacker.invalid'));
      assert(mail.html.includes('Recovery &lt;Test&gt;')); assert(!mail.html.includes('<Test>'));
      const raw = await User.collection().findOne({ _id: user._id });
      assert.equal(raw.passwordResetToken, hash(token));
      assert(+raw.passwordResetExpires > Date.now() + 14 * 60 * 1000);
      assert(!JSON.stringify(raw).includes(token));
      const nextPassword = 'Replacement-password-123';
      const done = await request('/auth/reset-password/' + token, { password: nextPassword });
      assert.equal(done.response.status, 200, JSON.stringify(done.data));
      assert(!done.data.token && !done.data.user);
      for (const jar of [first, second]) assert.equal((await request('/auth/me', undefined, jar, 'GET')).response.status, 401);
      assert.equal((await request('/auth/login', { email: user.email, password: initialPassword })).response.status, 401);
      await login(user, nextPassword);
      assert.equal((await request('/auth/reset-password/' + token, { password: 'Reused-password' })).response.status, 400);
      await queue.processNext();
      const notice = mails.at(-1); assert.equal(notice.subject, 'Your FEDEscape password was changed');
      assert(!notice.text.includes(nextPassword)); assert(!notice.text.includes(token));
    }
  });
  await t.test('expired, superseded, invalid and parallel reuse attempts are rejected', async () => {
    await clearQueues();const user = await makeUser();
    const expired = await requestLink(user);
    await User.collection().updateOne({ _id: user._id }, { $set: { passwordResetExpires: new Date(Date.now() - 1) } });
    assert.equal((await request('/auth/reset-password/' + expired.token, { password: 'Expired-123' })).response.status, 400);
    const old = await requestLink(user), current = await requestLink(user);
    assert.equal((await request('/auth/reset-password/' + old.token, { password: 'Stale-123' })).response.status, 400);
    assert.equal((await request('/auth/reset-password/not-valid', { password: 'Invalid-123' })).response.status, 400);
    const jar = await anonymous();
    const results = await Promise.all([request('/auth/reset-password/' + current.token, { password: 'One-use-only-123' }, jar),
      request('/auth/reset-password/' + current.token, { password: 'One-use-only-123' }, jar)]);
    assert.deepEqual(results.map(r => r.response.status).sort(), [200, 400]);
  });
  await t.test('invalid inputs and inactive/unverified accounts cannot use recovery', async () => {
    await clearQueues();
    assert.equal((await request('/auth/forgot-password', { email: { $ne: null } })).response.status, 400);
    assert.equal((await request('/auth/forgot-password', { email: 'not-an-email' })).response.status, 400);
    for (const overrides of [{ emailVerified: false }, { accountStatus: 'suspended' }]) {
      const user = await makeUser(overrides); const before = attempts;
      assert.equal((await request('/auth/forgot-password', { email: user.email })).response.status, 200);
      await queue.processNext(); assert.equal(attempts, before);
    }
    const user = await makeUser(); const { token } = await requestLink(user);
    for (const password of [null, {}, 'short', 'x'.repeat(73), '🙂'.repeat(19)]) {
      assert.equal((await request('/auth/reset-password/' + token, { password })).response.status, 400);
    }
    await login(user); // no password was changed
  });
  await t.test('SMTP failures retry durably, coalesce duplicate requests and expire after a bounded attempt count', async () => {
    await clearQueues(); const user = await makeUser(); const before = attempts;
    await queue.enqueueReset(user.email); await queue.enqueueReset(user.email);
    assert.equal(await db.collection('auth_email_jobs').countDocuments({}), 1);
    failMail = true;
    try {
      for (let i = 0; i < 3; i++) {
        await queue.processNext();
        assert.equal((await User.collection().findOne({ _id: user._id })).passwordResetToken, null);
        if (i < 2) {
          const pending = await db.collection('auth_email_jobs').findOne({});
          assert(pending.availableAt > new Date()); assert.equal(pending.attempts, i + 1);
          assert(!Object.hasOwn(pending, 'token'));
          await db.collection('auth_email_jobs').updateOne({ _id: pending._id }, { $set: { availableAt: new Date(0) } });
        }
      }
      assert.equal(attempts, before + 3);
      assert.equal(await db.collection('auth_email_jobs').countDocuments({}), 0);
    } finally { failMail = false; }
    await requestLink(user); // a subsequent request recovers once SMTP works
  });
  await t.test('leases prevent duplicate concurrent delivery and recover pending work after restart', async () => {
    await clearQueues(); const user = await makeUser(); const before = attempts;
    await queue.enqueueReset(user.email);
    await Promise.all([queue.processNext(), queue.processNext()]);
    assert.equal(attempts, before + 1);
    await queue.enqueueReset(user.email);
    const job = await db.collection('auth_email_jobs').findOne({});
    await db.collection('auth_email_jobs').updateOne({ _id: job._id }, { $set: { availableAt: new Date(Date.now() + 120000) } });
    assert.equal(await queue.processNext(), false);
    await db.collection('auth_email_jobs').updateOne({ _id: job._id }, { $set: { availableAt: new Date(0) } });
    delete require.cache[require.resolve('../utils/passwordResetQueue')];
    const restarted = require('../utils/passwordResetQueue');
    assert.equal(await restarted.processNext(), true);assert.equal(attempts, before + 2);
  });
});
