const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../../client/js/password-recovery.js'), 'utf8');
function setup({ reset = false, token = 'a'.repeat(64), fetch } = {}) {
  let submit, cleanedUrl;
  const button = { textContent: 'Submit', disabled: false };
  const form = { hidden: false, querySelector: () => button, addEventListener: (_, fn) => { submit = fn; },
    setAttribute() {}, removeAttribute() {}, reset() {} };
  const fields = { [reset ? 'resetPasswordForm' : 'forgotPasswordForm']: form,
    recoveryStatus: { textContent: '', setAttribute() {}, focus() {} },
    recoveryActions: { hidden: true }, recoveryLogin: { hidden: true },
    recoveryEmail: { value: '  student@example.invalid  ' },
    newPassword: { value: 'New-passphrase-123' }, confirmNewPassword: { value: 'New-passphrase-123' } };
  const calls = [];
  const window = { location: { href: 'http://localhost:5000/FEDEscape/reset-password.html#token=' + token },
    history: { replaceState: (_a, _b, url) => { cleanedUrl = url; } }, FEDEscapeConfig: { apiBaseUrl: '/FEDEscape/api' },
    FEDEscapeSession: { fetch: async (...args) => { calls.push(args); return fetch ? fetch(...args) : new Response(JSON.stringify({ message: 'Request accepted.' })); } } };
  vm.runInNewContext(source, { window, URL, URLSearchParams, TextEncoder, document: {
    getElementById: id => fields[id], addEventListener: (_, fn) => fn()
  } });
  return { fields, button, form, calls, cleanedUrl, submit: () => submit({ preventDefault() {} }) };
}
test('forgot-password sends a trimmed address, prevents duplicate submits, and confirms the request', async () => {
  let finish;
  const ui = setup({ fetch: () => new Promise(resolve => { finish = resolve; }) });
  const pending = ui.submit(); assert(ui.button.disabled); assert.match(ui.fields.recoveryStatus.textContent, /Requesting/);
  await ui.submit(); assert.equal(ui.calls.length, 1);
  assert.deepEqual(JSON.parse(ui.calls[0][1].body), { email: 'student@example.invalid' });
  finish(new Response(JSON.stringify({ message: 'If an account exists, an email will be sent.' })));
  await pending; assert(ui.form.hidden); assert.equal(ui.fields.recoveryLogin.hidden, false);
  assert.match(ui.fields.recoveryStatus.textContent, /If an account exists/);
});
test('reset token is removed from the URL and missing or malformed links cannot submit', () => {
  const ui = setup({ reset: true, token: 'invalid' });
  assert.equal(ui.cleanedUrl, '/FEDEscape/reset-password.html');
  assert(ui.form.hidden); assert.equal(ui.fields.recoveryActions.hidden, false);
  assert.equal(ui.calls.length, 0);
});
test('password confirmation and byte limits are checked before sending the reset', async () => {
  const ui = setup({ reset: true });
  ui.fields.confirmNewPassword.value = 'Mismatch'; await ui.submit();
  assert.match(ui.fields.recoveryStatus.textContent, /do not match/); assert.equal(ui.calls.length, 0);
  ui.fields.newPassword.value = ui.fields.confirmNewPassword.value = '🙂'.repeat(19);
  await ui.submit(); assert.equal(ui.calls.length, 0);
  ui.fields.newPassword.value = ui.fields.confirmNewPassword.value = 'Valid-new-password';
  await ui.submit(); assert.equal(ui.calls.length, 1);
  assert.equal(ui.calls[0][0], '/FEDEscape/api/auth/reset-password/' + 'a'.repeat(64));
  assert(ui.form.hidden); assert.equal(ui.fields.recoveryLogin.hidden, false);
  assert.match(ui.fields.recoveryStatus.textContent, /Log in with your new password/);
});
test('rate limits and expired links give useful feedback without hiding a retryable form', async () => {
  const limited = setup({ fetch: async () => new Response(JSON.stringify({ message: 'Too many attempts.' }), { status: 429, headers: { 'Retry-After': '120' } }) });
  await limited.submit(); assert.match(limited.fields.recoveryStatus.textContent, /2 minute/); assert.equal(limited.button.disabled, false);
  const expired = setup({ reset: true, fetch: async () => new Response(JSON.stringify({ message: 'Link expired.' }), { status: 400 }) });
  await expired.submit(); assert.equal(expired.fields.recoveryActions.hidden, false); assert.equal(expired.button.disabled, false);
});
