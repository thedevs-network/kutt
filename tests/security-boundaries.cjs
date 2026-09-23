const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { randomUUID, randomBytes } = require("node:crypto");
const Database = require("better-sqlite3");

module.exports = async ({ request, session, database, account, root, directory, env }) => {
  const db = new Database(database);
  const prefix = "boundary-" + randomUUID();
  const owner = db.prepare("SELECT * FROM users WHERE email=?").get(account.email);
  const checked = async (promise, status) => {
    const response = await promise, body = await response.text();
    assert.equal(response.status, status, body.slice(0, 300));
    return { response, body };
  };
  const code = source => {
    const child = spawnSync(process.execPath, ["-e", `
      const assert = require('node:assert/strict');
      const {randomUUID}=require('node:crypto');
      const from = p => require(${JSON.stringify(root)}+'/'+p);
      const knex=from('server/knex');
      (async()=>{${source}})().catch(e=>{console.error(e.stack);process.exitCode=1}).finally(()=>knex.destroy());
    `], { cwd: directory, env, encoding: "utf8", timeout: 30000 });
    assert.equal(child.status, 0, child.stderr || child.stdout || String(child.error));
  };
  try {
    const foreignKey = randomBytes(24).toString("hex");
    db.prepare("INSERT INTO users(email,password,verified,apikey) VALUES(?,?,1,?)").run(prefix + "@example.invalid", "not-a-login", foreignKey);
    const foreign = db.prepare("SELECT * FROM users WHERE apikey=?").get(foreignKey);
    const cross = { Origin: "https://sibling.example.invalid", "Sec-Fetch-Site": "same-site" };
    const writes = [["POST", "/users/admin"], ["POST", "/users/delete"], ["DELETE", "/users/admin/999999"],
      ["POST", "/users/admin/ban/999999"], ["POST", "/domains"], ["POST", "/domains/admin"],
      ["DELETE", "/domains/" + randomUUID()], ["DELETE", "/domains/admin/999999"], ["POST", "/domains/admin/ban/999999"],
      ["POST", "/auth/change-password"], ["POST", "/auth/change-email"], ["POST", "/auth/apikey"]];
    for (const api of ["/api", "/API/V2"]) {
      for (const [method, route] of writes) await checked(request(method, api + route, {}, session, cross), 403);
      for (const location of ["header", "body", "query"]) {
        const body = location === "body" ? { apikey: foreignKey } : {};
        const suffix = location === "query" ? "?apikey=" + foreignKey : "";
        const headers = { ...cross, ...(location === "header" ? { "X-API-Key": foreignKey } : {}) };
        await checked(request("POST", api + "/auth/apikey" + suffix, body, session, headers), 403);
      }
      await checked(request("GET", api + "/links", undefined, undefined, { "X-API-Key": foreignKey }), 200);
      const keyCreated = await checked(request("POST", api + "/auth/apikey", {}, session), 201);
      assert(JSON.parse(keyCreated.body).apikey);
    }
    assert.equal(db.prepare("SELECT auth_version FROM users WHERE id=?").get(owner.id).auth_version, owner.auth_version);
    for (const cookie of [undefined, session]) {
      const verification = randomUUID(), change = randomUUID(), email = randomUUID() + "@example.invalid";
      db.prepare("UPDATE users SET verified=0,verification_token=?,verification_expires='2099-01-01 00:00:00',change_email_token=?,change_email_address=?,change_email_expires='2099-01-01 00:00:00' WHERE id=?")
        .run(verification, change, email, foreign.id);
      for (const url of ["/verify/" + verification, "/verify-email/" + change]) {
        await checked(request("HEAD", url, undefined, cookie, { Accept: "text/html" }), 200);
        const result = await checked(request("GET", url, undefined, cookie, { Accept: "text/html" }), 200);
        assert(!result.response.headers.getSetCookie().some(value => /^token=/.test(value)), "Verification never switches or creates a session");
        assert(result.body.includes("Continue to sign in"));
      }
      assert.equal((await request("GET", "/api/links", undefined, cookie)).status, cookie ? 200 : 401);
    }
    const domainBody = { address: prefix + ".example.invalid", homepage: "https://example.com/" };
    const challenge = JSON.parse((await checked(request("POST", "/api/domains", domainBody, session), 409)).body).verification;
    assert.equal(challenge.record_name, "_kutt-verification." + domainBody.address);
    assert.equal(db.prepare("SELECT count(*) n FROM domains WHERE address=?").get(domainBody.address).n, 0);
    const html = await checked(request("POST", "/api/domains", domainBody, session, { Accept: "text/html", "HX-Request": "true" }), 200);
    assert(html.body.includes("Verify ownership") && html.body.includes('name="proof"'));
    for (const target of ["http://" + ":".repeat(60000) + "!", ["https://example.com/"], { url: "https://example.com/" }]) {
      await checked(request("POST", "/api/links", { target }, session), 400);
    }
    await checked(request("POST", "/api/domains", { ...domainBody, homepage: "https://example.com/" + "x".repeat(2100) }, session), 400);
    code(`
      const {urlRegex}=from('server/utils');
      const started=performance.now();
      for (let i=0;i<3;i++) assert.equal(urlRegex.test('http://'+':'.repeat(60000)+'!'),false);
      assert(performance.now()-started<1000,'Malformed userinfo must run in bounded time');
      for(const value of ['https://example.com/','http://example.com/a?b=c#d','ftp://user:pass@example.com/file','//example.com/','https://user:pa:ss@example.com/path','https://exämple.com/']) assert(urlRegex.test(value),value);
    `);
    code(`
      const query=from('server/queries/user.queries'), auth=from('server/handlers/auth.handler');
      const security=from('server/oidc-security');
      const current=()=>knex('users').where({id:${foreign.id}}).first();
      const pending=async()=>{
        const token=randomUUID(); await knex('users').where({id:${foreign.id}}).update({change_email_address:randomUUID()+'@example.invalid',change_email_token:token,change_email_expires:'2099-01-01 00:00:00',reset_password_token:randomUUID(),reset_password_expires:'2099-01-01 00:00:00'}); return token;
      };
      const cleared=user=>{for(const key of Object.keys(from('server/account-tokens'))) assert.equal(user[key],null,key);};
      let stale=await pending(), before=await current();
      await query.update({id:before.id},{password:'new-test-hash'}); cleared(await current());
      let res={locals:{},cookie(){assert.fail('verification must not log in')},clearCookie(){assert.fail('must not clear another session')}};
      await auth.changeEmail({method:'GET',params:{changeEmailToken:stale}},res,()=>{}); assert(!res.locals.token_verified);
      stale=await pending(); before=await current();
      await security.revoke(before.id); cleared(await current());
      assert.equal(await query.update({id:before.id,auth_version:before.auth_version},{change_email_token:stale,change_email_address:'stale@example.invalid'}),undefined);
      const verification=randomUUID();
      await knex('users').where({id:before.id}).update({verified:false,verification_token:verification,verification_expires:'2099-01-01 00:00:00'});
      const req={method:'HEAD',params:{verificationToken:verification},cookies:{token:'unrelated-session'}};
      await auth.verify(req,res,()=>{}); assert.equal((await current()).verified,0);
      req.method='GET'; await auth.verify(req,res,()=>{}); assert(res.locals.token_verified); assert.equal(req.cookies.token,'unrelated-session');
      stale=await pending(); before=await current(); res.locals={};
      await auth.changeEmail({method:'HEAD',params:{changeEmailToken:stale}},res,()=>{}); assert.equal((await current()).change_email_token,stale);
      await auth.changeEmail({method:'GET',params:{changeEmailToken:stale}},res,()=>{}); assert(res.locals.token_verified);
      assert.equal((await current()).email,before.change_email_address); cleared(await current());
      assert.equal(Number((await current()).auth_version),Number(before.auth_version)+1);
    `);
    code(`
      const proof=from('server/domain-verification'), domains=from('server/queries/domain.queries');
      const {Resolver}=require('node:dns/promises');
      const user=await knex('users').where({id:${owner.id}}).first();
      const other=await knex('users').where({id:${foreign.id}}).first();
      const address=${JSON.stringify(domainBody.address)};
      const a=proof.challenge(address,user);
      Resolver.prototype.resolveTxt=async name=>{assert.equal(name,a.record_name);return [[a.record_value.slice(0,20),a.record_value.slice(20)]]};
      assert(await proof.verify(address,user,a.proof));
      for(const [host,who,value] of [[address,other,a.proof],['other.example.invalid',user,a.proof],[address,{...user,auth_version:Number(user.auth_version)+1},a.proof],[address,user,a.proof+'x']]) assert.equal(await proof.verify(host,who,value),false);
      const jwt=from('node_modules/jsonwebtoken'), decoded=jwt.decode(a.proof);
      const expired=jwt.sign({...decoded,exp:1},process.env.JWT_SECRET,{algorithm:'HS256'}); assert.equal(await proof.verify(address,user,expired),false);
      Resolver.prototype.resolveTxt=async()=>[['unrelated-record']]; assert.equal(await proof.verify(address,user,a.proof),false);
      assert.equal(proof.pending(address,user,a.proof).proof,a.proof);
      await knex('domains').insert({address,user_id:null,banned:false});
      const old=await knex('domains').where({address}).first();
      const claims=await Promise.allSettled([domains.claim({address,homepage:'https://example.com/',user}),domains.claim({address,user:other})]);
      assert.equal(claims.filter(r=>r.status==='fulfilled').length,1);
      const won=await knex('domains').where({address}).first(); assert.equal(won.id,old.id);assert.equal(won.uuid,old.uuid);
      const loser=won.user_id===user.id?other:user;
      assert.equal(await domains.release(won.id,loser.id),null); assert.equal((await knex('domains').where({address}).first()).user_id,won.user_id);
      await domains.release(won.id,won.user_id); await knex('domains').where({address}).update({banned:true});
      await assert.rejects(()=>domains.claim({address,user}),/unavailable/); assert((await knex('domains').where({address}).first()).banned);
    `);
    code(`
      const hooks=from('server/webhooks'), queue=from('server/webhook-queue');
      const user=await knex('users').where({id:${owner.id}}).first(), other=await knex('users').where({id:${foreign.id}}).first();
      const now=Date.now(), ids=[randomUUID(),randomUUID()];
      for(const [i,who] of [user,other].entries()) await knex('webhooks').insert({id:ids[i],user_id:who.id,name:'Bounded queue',url:'https://example.com/hook',secret:hooks.encrypt('test-secret',ids[i]),events:JSON.stringify(['link.updated']),enabled:true,revision:1,auth_version:who.auth_version,created_at:now,updated_at:now});
      const req={user,params:{id:ids[0]},body:{revision:1}};
      const first=await hooks.test(req); await hooks.test(req); await hooks.test({...req,user:other,params:{id:ids[1]}});
      const one=await hooks.claim(Date.now()+1),two=await hooks.claim(Date.now()+2); assert.notEqual(one.user_id,two.user_id,'Owner fairness');
      await knex('webhook_deliveries').where({id:one.id}).update({lease_until:now-1});
      const counter=await knex('webhook_queue_owners').where({user_id:user.id}).first();
      await hooks.claim(Date.now()+3); assert.equal((await knex('webhook_queue_owners').where({user_id:user.id}).first()).admitted,counter.admitted,'Lease reclaim is not a new admission');
      await knex('webhook_deliveries').where({id:first.delivery_id}).update({state:'failed',lease:null,lease_until:null});
      await knex('webhook_queue_owners').where({user_id:user.id}).update({admitted:queue.LIMITS.ownerPerMinute,window_start:Date.now()});
      const before=Number((await knex('management_events').count('* as n').first()).n);
      await assert.rejects(()=>hooks.test(req),/capacity/);
      await assert.rejects(()=>hooks.retry({...req,body:{revision:1,delivery_id:first.delivery_id}}),/capacity/);
      await assert.rejects(()=>knex.transaction(db=>hooks.record(db,{user_id:user.id,uuid:randomUUID()},'updated',[])),/capacity/);
      assert.equal(Number((await knex('management_events').count('* as n').first()).n),before);
      const link=await knex('links').where({user_id:user.id}).first();
      await assert.rejects(()=>knex.transaction(async db=>{await db('links').where({id:link.id}).update({target:'https://should-rollback.invalid/'});await hooks.record(db,link,'updated',['target']);}),/capacity/);
      assert.equal((await knex('links').where({id:link.id}).first()).target,link.target,'Link and outbox roll back together');
      await assert.rejects(()=>knex.transaction(db=>hooks.record(db,link,'updated',['banned'],{id:other.id})),/capacity/,'Ordinary owners cannot bypass capacity');
      await assert.rejects(()=>knex.transaction(db=>hooks.record(db,link,'updated',['target'],{id:user.id})),/capacity/,'Administrator ordinary edits retain admission limits');
      await knex('webhook_queue_state').where({id:1}).update({admitted:queue.LIMITS.globalPerMinute,window_start:Date.now()});
      await assert.rejects(()=>hooks.test({...req,user:other,params:{id:ids[1]}}),/capacity/);
      await knex('webhook_queue_owners').where({user_id:user.id}).update({window_start:0,admitted:0});
      await knex('webhook_queue_state').where({id:1}).update({window_start:0,admitted:0});
      const event=await knex('management_events').where({id:first.event_id}).first();
      const rows=Array.from({length:queue.LIMITS.ownerPending},()=>({id:randomUUID(),webhook_id:ids[0],event_id:randomUUID(),revision:1,state:'pending',created_at:now,next_at:now}));
      for(let start=0;start<rows.length;start+=50){const batch=rows.slice(start,start+50);await knex('management_events').insert(batch.map(row=>({id:row.event_id,user_id:user.id,type:'webhook.test',payload:event.payload,created_at:now})));await knex('webhook_deliveries').insert(batch);}
      await assert.rejects(()=>hooks.test(req),/capacity/);
      await hooks.test({...req,user:other,params:{id:ids[1]}});
      for(let start=rows.length;start<queue.LIMITS.globalPending;start+=50){const batch=Array.from({length:50},()=>({id:randomUUID(),webhook_id:ids[0],event_id:randomUUID(),revision:1,state:'pending',created_at:now,next_at:now}));await knex('management_events').insert(batch.map(row=>({id:row.event_id,user_id:user.id,type:'webhook.test',payload:event.payload,created_at:now})));await knex('webhook_deliveries').insert(batch);}
      await assert.rejects(()=>hooks.test({...req,user:other,params:{id:ids[1]}}),/capacity/);
      await knex('webhooks').whereIn('id',ids).delete();
      await knex('webhook_queue_owners').whereIn('user_id',[user.id,other.id]).update({admitted:0,window_start:0});
      await knex('webhook_queue_state').where({id:1}).update({admitted:0,window_start:0});
    `);
    const moderationHook = randomUUID(), moderationLink = randomUUID(), now = Date.now();
    const currentForeign = db.prepare("SELECT * FROM users WHERE id=?").get(foreign.id);
    db.prepare("INSERT INTO webhooks(id,user_id,name,url,secret,events,enabled,revision,auth_version,created_at,updated_at) VALUES(?,?,?,?,?,?,1,1,?,?,?)")
      .run(moderationHook, foreign.id, "Moderation quota test", "https://example.com/hook", "unused-secret", JSON.stringify(["link.updated", "link.trashed"]), currentForeign.auth_version, now, now);
    db.prepare("UPDATE webhook_queue_owners SET admitted=1000,window_start=? WHERE user_id=?").run(now, foreign.id);
    for (const api of ["/api", "/api/v2"]) {
      const uuid = api === "/api" ? moderationLink : randomUUID();
      db.prepare("INSERT INTO links(uuid,address,target,user_id) VALUES(?,?,?,?)").run(uuid, "mod-" + uuid, "https://example.com/moderation", foreign.id);
      await checked(request("POST", api + "/links/admin/ban/" + uuid, {}, session), 200);
      assert.equal(db.prepare("SELECT banned FROM links WHERE uuid=?").get(uuid).banned, 1);
      const event = db.prepare("SELECT * FROM management_events WHERE user_id=? AND type='link.updated' ORDER BY sequence DESC LIMIT 1").get(foreign.id);
      assert.deepEqual(JSON.parse(event.payload).delivery, { status: "not_queued", reason: "CAPACITY_LIMIT" });
      assert.equal(db.prepare("SELECT count(*) n FROM webhook_deliveries WHERE event_id=?").get(event.id).n, 0);
    }
    code(`
      const link=await knex('links').where({uuid:${JSON.stringify(moderationLink)}}).first();
      await knex.transaction(db=>from('server/link-history').trash(db,link,{id:${owner.id}}));
      assert((await knex('links').where({id:link.id}).first()).deleted_at);
      const event=await knex('management_events').where({user_id:link.user_id,type:'link.trashed'}).orderBy('sequence','desc').first();
      assert.equal(JSON.parse(event.payload).delivery.status,'not_queued');
    `);
    db.prepare("DELETE FROM webhooks WHERE id=?").run(moderationHook);
    db.prepare("UPDATE webhook_queue_owners SET admitted=0,window_start=0 WHERE user_id=?").run(foreign.id);
    assert.equal(db.pragma("quick_check", { simple: true }), "ok");
    assert.equal(db.pragma("foreign_key_check").length, 0);
    console.log("PASS: cross-site legacy writes, credential principal binding, domain DNS proof/atomic claim, recovery generation, verification without login, bounded URL validation and fair bounded webhook admission");
  } finally {
    db.prepare("UPDATE users SET apikey=? WHERE id=?").run(owner.apikey, owner.id);
    db.close();
  }
};
