const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');const path=require('node:path');
test('registration shows progress, blocks duplicates and restores button after failure',async()=>{
 let handler,resolve,requests=0;
 const button={textContent:'Create Account',disabled:false};const status={textContent:''};
 const form={querySelector:()=>button,addEventListener:(event,fn)=>handler=fn,setAttribute(){},removeAttribute(){}};
 const fields={registerForm:form,registerStatus:status,registerName:{value:'Test User'},registerEmail:{value:'test@example.invalid'},registerPassword:{value:'testpass'},registerConfirmPassword:{value:'testpass'},registerRole:{value:'student'}};
 const context={window:{FEDEscapeConfig:{apiBaseUrl:'/api'},location:{}},document:{addEventListener(){},getElementById:id=>fields[id]},setTimeout,clearTimeout,alert(){},console,fetch:()=>{requests++;return new Promise(r=>resolve=r)}};
 vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../../client/js/script.js'),'utf8'),context);vm.runInContext('initialiseRegisterForm()',context);
 const pending=handler({preventDefault(){}});assert.equal(button.disabled,true);assert.match(status.textContent,/sending/);
 await handler({preventDefault(){}});assert.equal(requests,1);
 resolve({ok:false,json:async()=>({message:'Test rejection'})});await pending;
 assert.equal(button.disabled,false);assert.equal(button.textContent,'Create Account');assert.equal(status.textContent,'');
});
