const assert = require("node:assert/strict");
const Database = require("better-sqlite3");
const { createHash } = require("node:crypto");
module.exports = async function shortcutTests({ request, session, database, account, restart }) {
  require("./shortcut-template.cjs")();
  const db = new Database(database), count = () => db.prepare('SELECT COUNT(*) n FROM api_tokens').get().n;
  try {
    const owner = db.prepare('SELECT * FROM users WHERE email=?').get(account.email);
    db.prepare("INSERT INTO users(email,password,verified,role) VALUES(?,?,1,'USER')").run('shortcut-other@example.invalid', owner.password);
    const other = (await (await request('POST','/api/v2/auth/login',{...account,email:'shortcut-other@example.invalid'})).json()).token;
    assert(other);
    let previous;
    for (const prefix of ['/api','/api/v2']) {
      for (const suffix of ['', '/template', '/guide']) assert.equal((await request('GET', prefix + '/shortcuts' + suffix)).status, 401);
      assert.equal((await request('POST', prefix + '/shortcuts/token', {name:'No session'})).status, 401);
      const response = await request('GET', prefix + '/shortcuts', undefined, session, {'X-Forwarded-Host':'attacker.invalid'});
      assert.equal(response.status, 200); assert.match(response.headers.get('cache-control'), /no-store/);
      const recipe = await response.json();
      assert(!recipe.endpoint.includes('attacker')); assert.match(recipe.endpoint,/^https:\/\/127\.0\.0\.1:\d+\/api\/v2\/links$/);
      assert.deepEqual(recipe.token_policy, {scopes:['links:create'],domain_scope:'default',expires_in_days:30});
      assert.deepEqual(recipe.body,{target:'Selected URL',reuse:true});
      const download = await request('GET',prefix+'/shortcuts/template',undefined,session);
      assert.equal(download.status,200); assert.match(download.headers.get('content-disposition'),/attachment; filename="Kutt-Shorten-URL.shortcut"/);
      assert.match(download.headers.get('cache-control'), /no-store/);
      assert.equal(createHash('sha256').update(Buffer.from(await download.arrayBuffer())).digest('hex'),require('../examples/shortcut-artifact.json').signed_sha256);
      const guide = await request('GET',prefix+'/shortcuts/guide',undefined,session);
      assert.equal(guide.status,200); assert((await guide.text()).includes('No new database migration'));
      const before = count();
      for (const input of [{}, {name:''}, {name:'x'.repeat(81)}, {name:'Escalation',scopes:['links:delete']}, {name:'Escalation',domain_scope:'all'}, {name:'Escalation',expires_in_days:'never'}, {name:'Escalation',user_id:owner.id}, []]) {
        assert.equal((await request('POST',prefix+'/shortcuts/token',input,session)).status,400);
      }
      assert.equal((await request('POST',prefix+'/shortcuts/token',{name:'CSRF'},session,{Origin:'https://attacker.invalid'})).status,403);
      assert.equal((await request('POST',prefix+'/shortcuts/token',{name:'CSRF'},session,{'Sec-Fetch-Site':'cross-site'})).status,403);
      assert.equal(count(),before);
      const minted = await request('POST',prefix+'/shortcuts/token',{name:'My iPhone'},other);
      assert.equal(minted.status,201); const key=await minted.json();
      assert.deepEqual(key.scopes,['links:create']); assert.equal(key.domain_scope,'default');
      assert(Date.parse(key.expires_at)>Date.now()+29*86400000 && Date.parse(key.expires_at)<=Date.now()+30*86400000);
      const stored=db.prepare('SELECT * FROM api_tokens WHERE id=?').get(key.id);
      assert.equal(stored.token_hash,createHash('sha256').update(key.token).digest('hex'));
      assert(!JSON.stringify(stored).includes(key.token)); assert.notEqual(stored.user_id,owner.id);
      const keyed=(method,path,body)=>request(method,prefix+path,body,session,{'X-API-Key':key.token});
      for (const [method,path,body] of [['GET','/shortcuts'],['GET','/shortcuts/template'],['GET','/shortcuts/guide'],['POST','/shortcuts/token',{name:'Escalation'}],['GET','/tokens'],['GET','/links'],['GET','/users/admin']]) assert.equal((await keyed(method,path,body)).status,403);
      assert.equal((await request('DELETE',prefix+'/tokens/'+key.id,undefined,session)).status,404,'Admin cookie cannot revoke another owner token');
      const created=await keyed('POST','/links',{target:'https://192.0.2.113/shortcut'+prefix.replaceAll('/','-'),reuse:'true'});
      assert.equal(created.status,201); const link=await created.json(); assert(link.link);
      const row=db.prepare('SELECT * FROM links WHERE uuid=?').get(link.id);
      assert.equal(row.user_id,stored.user_id); assert.equal(row.domain_id,null);
      const again=await keyed('POST','/links',{target:link.target,reuse:'true'});
      assert.equal(again.status,200); assert.equal((await again.json()).id,link.id);
      assert.equal((await keyed('PATCH','/links/'+link.id,{description:'Denied'})).status,403);
      assert.equal((await keyed('DELETE','/links/'+link.id)).status,403);
      assert.equal((await keyed('POST','/links',{target:'https://example.com/',domain:'other-domain.example'})).status,400);
      const redirect=await request('GET','/'+link.address); assert.equal(redirect.status,302); assert.equal(redirect.headers.get('location'),link.target);
      await restart(); assert.equal((await keyed('POST','/links',{target:link.target,reuse:true})).status,200);
      db.prepare('UPDATE api_tokens SET expires_at=? WHERE id=?').run(Date.now()-1,key.id);
      assert.equal((await keyed('POST','/links',{target:link.target,reuse:true})).status,401);
      db.prepare('UPDATE api_tokens SET expires_at=? WHERE id=?').run(Date.parse(key.expires_at),key.id);
      assert.equal((await request('DELETE',prefix+'/tokens/'+key.id,undefined,other)).status,204);
      assert.equal((await keyed('POST','/links',{target:link.target,reuse:true})).status,401);
      previous=key.token;
    }
    const html=await request('GET','/settings/shortcuts',undefined,session,{Accept:'text/html'});
    assert.equal(html.status,200); const text=await html.text(); assert(text.includes('id="shortcut-form"')); assert(!text.includes(previous));
    assert.match(html.headers.get('cache-control'),/no-store/);
    const legacy='test-legacy-shortcut'; db.prepare('UPDATE users SET apikey=? WHERE id=?').run(legacy,owner.id);
    assert.equal((await request('POST','/api/v2/shortcuts/token',{name:'Denied'},session,{'X-API-Key':legacy})).status,403);
    assert.equal((await request('GET','/settings/shortcuts',undefined,session,{Accept:'text/html','X-API-Key':legacy})).status,403);
    assert.equal(db.pragma('quick_check',{simple:true}),'ok'); assert.deepEqual(db.pragma('foreign_key_check'),[]);
    console.log('PASS: Shortcut session-only setup/downloads, fixed scoped/expiring/hashed owner tokens, CSRF, cookie non-elevation, reuse, public redirect, restart, expiry and revocation');
  } finally { db.close(); }
};
