const { test } = require('node:test');
const assert = require('node:assert/strict');
process.env.APP_BASE_PATH = '/FEDEscape';
const app = require('../server');
test('combined frontend and API under deployment prefix, private files excluded', async t => {
 const server=app.listen(0,'127.0.0.1');
 await new Promise(r=>server.once('listening',r));
 t.after(()=>new Promise(r=>server.close(r)));
 const base=`http://127.0.0.1:${server.address().port}`;
 for(const route of ['/FEDEscape/','/FEDEscape/register.html','/FEDEscape/client/verify-email.html']) {
  const r=await fetch(base+route);assert.equal(r.status,200,route);assert.match(r.headers.get('content-type'),/html/);
 }
 for(const route of ['/FEDEscape/js/config.js','/FEDEscape/client/js/config.js']) {
  const r=await fetch(base+route);assert.match(await r.text(),/\/FEDEscape\/api/);
 }
 for(const route of ['/FEDEscape/server/server.js','/FEDEscape/.env','/FEDEscape/package.json']) assert.equal((await fetch(base+route)).status,404);
 const api=await fetch(base+'/FEDEscape/api/missing');assert.equal(api.status,404);assert.equal((await api.json()).success,false);
});
