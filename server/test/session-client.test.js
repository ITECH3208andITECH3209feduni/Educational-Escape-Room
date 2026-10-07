const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const script=fs.readFileSync(path.join(__dirname,'../../client/js/session.js'),'utf8');
function client(fetch,initial={}) {
  const values=new Map(Object.entries(initial));const alerts=[];
  const storage={getItem:key=>values.get(key)||null,removeItem:key=>values.delete(key)};
  const window={fetch,location:{href:'http://localhost:5000/FEDEscape/login.html',origin:'http://localhost:5000'},
    FEDEscapeConfig:{apiBaseUrl:'/FEDEscape/api',appBaseUrl:'/FEDEscape/'}};
  vm.runInNewContext(script,{window,localStorage:storage,document:{addEventListener(){}},URL,Headers,alert:m=>alerts.push(m)});
  return {api:window.FEDEscapeSession,window,values,alerts};
}
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
test('shared client sends cookies and CSRF, rotates CSRF after login, never sends a bearer credential',async()=>{
  const calls=[];
  const c=client(async(url,options)=>{
    calls.push({url,options});
    if(String(url).endsWith('/csrf'))return json({csrfToken:'a'.repeat(64)});
    if(String(url).endsWith('/login'))return json({csrfToken:'b'.repeat(64),user:{id:'test'}});
    return json({success:true});
  });
  await c.api.fetch('/FEDEscape/api/auth/login',{method:'POST',body:'{}'});
  await c.api.fetch('/FEDEscape/api/rooms',{method:'POST',body:'{}'});
  assert.equal(calls.length,3);
  assert.equal(calls[1].options.headers.get('X-CSRF-Token'),'a'.repeat(64));
  assert.equal(calls[2].options.headers.get('X-CSRF-Token'),'b'.repeat(64));
  for(const call of calls){assert.equal(call.options.credentials,'same-origin');assert(!new Headers(call.options.headers).has('Authorization'));}
  await assert.rejects(c.api.fetch('https://other.invalid/api'),/Node server/);
});
test('CSRF renewal retries only a rejected request, logout waits for server success',async()=>{
  let bootstraps=0,posts=0;
  const c=client(async(url)=>{
    if(String(url).endsWith('/csrf')){bootstraps++;return json({csrfToken:String(bootstraps).repeat(64)});}
    if(++posts===1)return json({code:'CSRF_INVALID'},403);
    return json({success:true});
  },{fedEscapeLoggedIn:'true'});
  await c.api.logout();
  assert.equal(bootstraps,2);assert.equal(posts,2);
  assert(!c.values.has('fedEscapeLoggedIn'));
  assert.equal(c.window.location.href,'http://localhost:5000/FEDEscape/login.html');
  const failed=client(async(url)=>String(url).endsWith('/csrf')?json({csrfToken:'a'.repeat(64)}):json({},500),{fedEscapeLoggedIn:'true'});
  await failed.api.logout();assert(failed.values.has('fedEscapeLoggedIn'));assert.equal(failed.alerts.length,1);
});
test('legacy localStorage credentials are removed and 401 clears stale UI login hints',async()=>{
  const old=client(async()=>json({}),{fedEscapeToken:'old-jwt',fedEscapeLoggedIn:'true'});
  assert.equal(old.values.size,0);assert.equal(old.api.hasSessionHint(),false);
  const c=client(async()=>json({},401),{fedEscapeLoggedIn:'true',fedEscapeUserRole:'educator'});
  await c.api.fetch('/FEDEscape/api/auth/me');assert.equal(c.values.size,0);
});
test('every frontend page loads the shared session script and contains no CSP-blocked inline script or handler',()=>{
  const root=path.join(__dirname,'../../client');
  function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
  for(const file of walk(root).filter(p=>p.endsWith('.html'))) {
    const html=fs.readFileSync(file,'utf8');
    assert(!/<script\b(?![^>]*\bsrc=)[^>]*>\s*\S/i.test(html),file);
    assert(!/\son[a-z]+\s*=/i.test(html),file);
    const config=html.indexOf('js/config.js'),session=html.indexOf('js/session.js');
    assert(config>=0&&session>config,file);
    for(const [,src] of html.matchAll(/<script\s+src="([^"]+)"/g))assert(fs.existsSync(path.resolve(path.dirname(file),src)),src);
  }
});
