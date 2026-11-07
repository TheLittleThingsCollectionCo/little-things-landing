const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const code = fs.readFileSync('docs/waitlist-apps-script.gs','utf8');
const html = fs.readFileSync('docs/Waitlist.html','utf8');

function receiver(options = {}) {
  const headers = ['timestamp','email','source','page','request_id','consent'];
  const rows = [headers, ...(options.rows || [])];
  let released = 0;
  const sheet = {
    getLastRow: () => rows.length,
    getMaxRows: () => 1000,
    insertRowsAfter: () => {},
    getRange: (row,col,n,m) => ({
      setNumberFormat: () => {},
      setValues: values => {
        if (options.writeError) throw Error('write failed');
        rows[row-1] = values[0].map(s => s.startsWith("'") ? s.slice(1) : s);
      },
      getDisplayValues: () => {
        if (options.readError && row > 1) throw Error('read failed');
        const result = rows.slice(row-1,row-1+n).map(r=>r.slice(col-1,col-1+m));
        if (options.mismatch && row > 1 && n === 1) return [['bad']];
        return result;
      }
    })
  };
  const ctx = {
    PropertiesService: {getScriptProperties:()=>({getProperty:key => key === 'ENABLED' ? (options.disabled ? 'false' : 'true') : 'private-sheet-id'})},
    CacheService: {getScriptCache:()=>({get:()=>options.expired ? null : String(Date.now()-2000)})},
    LockService: {getScriptLock:()=>({tryLock:()=>!options.busy,releaseLock:()=>released++})},
    SpreadsheetApp: {openById:()=>({getSheetByName:()=>options.missing ? null : sheet}),flush:()=>{}}
  };
  vm.createContext(ctx); vm.runInContext(code,ctx);
  return {ctx,rows,get released(){return released;}};
}
const data = (overrides={})=>({email:'receipt-test@example.com',token:'11111111-1111-4111-8111-111111111111',requestId:'22222222-2222-4222-8222-222222222222',consent:true,website:'',...overrides});

test('receipt follows write and readback; retry appends once',()=>{
  const r=receiver();
  assert.equal(r.ctx.submitWaitlist(data()).ok,true);
  assert.equal(r.rows[1][1],'receipt-test@example.com');
  assert.equal(r.ctx.submitWaitlist(data()).ok,true);
  assert.equal(r.rows.length,2);
  assert.equal(r.released,2);
});
test('formula-like address stays literal in write payload',()=>{
  const r=receiver();
  assert.equal(r.ctx.submitWaitlist(data({email:'=x@example.com'})).ok,true);
  assert.equal(r.rows[1][1],'=x@example.com');
});
for (const options of [{disabled:true},{expired:true},{busy:true},{missing:true},{writeError:true},{readError:true},{mismatch:true}]) {
  test('no success on '+JSON.stringify(options),()=>{
    const r=receiver(options);
    assert.throws(()=>r.ctx.submitWaitlist(data()),/Receipt could not be confirmed/);
  });
}
test('invalid addresses, missing consent and honeypot never append',()=>{
  for (const override of [{email:'bad'},{email:'a\n@example.com'},{email:'a'.repeat(255)+'@example.com'},{consent:false},{website:'bot'},{requestId:'bad'}]) {
    const r=receiver();assert.throws(()=>r.ctx.submitWaitlist(data(override)));assert.equal(r.rows.length,1);
  }
});
test('ambiguous read failure can be retried without duplicate row',()=>{
  const opts={readError:true};const r=receiver(opts);
  assert.throws(()=>r.ctx.submitWaitlist(data()));
  opts.readError=false;
  assert.equal(r.ctx.submitWaitlist(data()).ok,true);
  assert.equal(r.rows.length,2);
});
test('reused ID with another address is rejected',()=>{
  const r=receiver();r.ctx.submitWaitlist(data());
  assert.throws(()=>r.ctx.submitWaitlist(data({email:'different@example.com'})));
});
test('global daily cap and recent-address throttle fail visibly',()=>{
  const row = [new Date().toISOString(),'receipt-test@example.com','landing','/', 'other','launch-notification-v1'];
  assert.throws(()=>receiver({rows:[row]}).ctx.submitWaitlist(data()));
  const rows=Array.from({length:200},(_,i)=>[row[0],`test${i}@example.com`,'landing','/',String(i),'consent']);
  assert.throws(()=>receiver({rows}).ctx.submitWaitlist(data()));
});

function client() {
  const listeners={}; const timers=[]; let success,failure;
  const nodes={
    email:{value:'receipt-test@example.com',addEventListener:(name,fn)=>listeners[name]=fn},
    status:{textContent:''},consent:{checked:true},website:{value:''},
    notify:{hidden:false,reportValidity:()=>true,addEventListener:(name,fn)=>listeners[name]=fn,querySelector:()=>button}
  };
  const button={disabled:false};
  const rpc={withSuccessHandler:fn=>{success=fn;return rpc;},withFailureHandler:fn=>{failure=fn;return rpc;},submitWaitlist:()=>{}};
  const context={document:{getElementById:id=>nodes[id]},crypto:{randomUUID:()=>data().requestId},
    google:{script:{run:rpc}},setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout:()=>{}};
  vm.createContext(context);
  vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1].replace('<?= token ?>',data().token),context);
  return {nodes,button,submit:()=>listeners.submit({preventDefault(){}}),success:r=>success(r),fail:()=>failure(),timeout:()=>timers.at(-1)()};
}
test('frontend requires matching receipt, retains form on failure',()=>{
  const c=client();c.submit();assert.equal(c.button.disabled,true);
  c.success({ok:true,requestId:'wrong'});
  assert.equal(c.nodes.notify.hidden,false);
  assert.match(c.nodes.status.textContent,/could not be confirmed/);
  c.submit();c.success({ok:true,requestId:data().requestId});
  assert.equal(c.nodes.notify.hidden,true);
});
test('timeout and late response never create misleading success',()=>{
  const c=client();c.submit();c.timeout();
  c.success({ok:true,requestId:data().requestId});
  assert.equal(c.nodes.notify.hidden,false);
  assert.equal(c.button.disabled,false);
});
test('RPC failure keeps address available for retry',()=>{
  const c=client();c.submit();c.fail();
  assert.equal(c.nodes.email.value,'receipt-test@example.com');
  assert.equal(c.nodes.notify.hidden,false);
});
test('empty or malformed endpoint exposes no signup or success',()=>{
  const index=fs.readFileSync('index.html','utf8');
  for(const endpoint of ['', 'https://evil.example/exec']) {
    const nodes={'waitlist-link':{hidden:true},'waitlist-unavailable':{hidden:false}};
    const ctx={document:{getElementById:id=>nodes[id]}};vm.createContext(ctx);
    vm.runInContext(index.match(/<script>([\s\S]*?)<\/script>/)[1].replace('const WAITLIST_ENDPOINT = "";',`const WAITLIST_ENDPOINT = ${JSON.stringify(endpoint)};`),ctx);
    assert.equal(nodes['waitlist-link'].hidden,true);
    assert.equal(nodes['waitlist-unavailable'].hidden,false);
  }
  assert.equal(index.includes('localStorage'),false);
  assert.equal(index.includes('no-cors'),false);
});
