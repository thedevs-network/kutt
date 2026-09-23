const assert = require("node:assert/strict");
const { randomUUID, randomBytes } = require("node:crypto");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const Database = require("better-sqlite3");

module.exports = async ({ request, session, database, account, restart, root, directory, env }) => {
  const db = new Database(database);
  const owner = db.prepare("SELECT * FROM users WHERE email=?").get(account.email);
  const prefix = "security-" + randomUUID();
  const checked = async (promise, status = 200) => {
    const response = await promise; const body = await response.text();
    assert.equal(response.status, status, body.slice(0, 300));
    try { return JSON.parse(body); } catch { return body; }
  };
  const code = (source, extraEnv = {}) => {
    const child = spawnSync(process.execPath, ["-e", `
      const assert = require('node:assert/strict');
      const knex = require(${JSON.stringify(path.join(root, "server/knex"))});
      (async()=>{${source}})().catch(e=>{console.error(e.stack);process.exitCode=1}).finally(()=>knex.destroy());
    `], { cwd: directory, env: { ...env, ...extraEnv }, encoding: "utf8", timeout: 30000 });
    assert.equal(child.status, 0, child.stderr || child.stdout);
  };
  try {
    const legacy = randomBytes(24).toString("hex");
    db.prepare("UPDATE users SET apikey=? WHERE id=?").run(legacy, owner.id);
    for (const api of ["/api", "/api/v2"]) {
      const endpoint = api + "/analytics/retention";
      const policy = await checked(request("GET", endpoint, undefined, session));
      const preview = await checked(request("POST", endpoint + "/preview", { days: 0, revision: policy.revision }, session));
      for (const cookie of [undefined, session]) {
        for (const method of ["GET", "POST", "PUT"]) {
          const suffix = method === "POST" ? "/preview" : "";
          const body = method === "POST" ? { days: 0, revision: policy.revision } : method === "PUT" ? { confirmation: preview.confirmation } : undefined;
          await checked(request(method, endpoint + suffix + "?apikey=" + legacy, body, cookie), 403);
          await checked(request(method, endpoint + suffix, body, cookie, { "X-API-Key": legacy }), 403);
          if (body) await checked(request(method, endpoint + suffix, { ...body, apikey: legacy }, cookie), 403);
        }
      }
      assert.deepEqual(await checked(request("GET", endpoint, undefined, session)), policy);
    }
    db.prepare("UPDATE users SET apikey=? WHERE id=?").run(owner.apikey, owner.id);

    const link = await checked(request("POST", "/api/links", { target: "https://192.0.2.1/security", customurl: prefix, password: "protected-secret" }, session), 201);
    const original = db.prepare("SELECT * FROM links WHERE uuid=?").get(link.id);
    for (const api of ["/api", "/api/v2"]) for (const admin of ["", "admin/"]) {
      const endpoint = api + "/links/" + admin + link.id;
      await checked(request("PATCH", endpoint, { description: randomUUID() }, session));
      assert.equal(db.prepare("SELECT password FROM links WHERE uuid=?").get(link.id).password, original.password);
      await checked(request("PATCH", endpoint, { description: randomUUID(), password: "\u2022\u2022\u2022\u2022" }, session));
      assert.equal(db.prepare("SELECT password FROM links WHERE uuid=?").get(link.id).password, original.password);
      await checked(request("PATCH", endpoint, { password: "" }, session));
      assert.equal(db.prepare("SELECT password FROM links WHERE uuid=?").get(link.id).password, null);
      db.prepare("UPDATE links SET password=? WHERE uuid=?").run(original.password, link.id);
      await checked(request("PATCH", endpoint, { password: null }, session));
      assert.equal(db.prepare("SELECT password FROM links WHERE uuid=?").get(link.id).password, null);
      db.prepare("UPDATE links SET password=? WHERE uuid=?").run(original.password, link.id);
    }
    const domain = Number(db.prepare("INSERT INTO domains(uuid,address,user_id,banned) VALUES(?,?,?,1)").run(randomUUID(), prefix + ".invalid", owner.id).lastInsertRowid);
    db.prepare("UPDATE links SET domain_id=? WHERE uuid=?").run(domain, link.id);
    for (const api of ["/api", "/api/v2"]) await checked(request("POST", api + "/links/" + link.id + "/protected", { password: "protected-secret" }), 410);
    db.prepare("UPDATE links SET domain_id=NULL WHERE uuid=?").run(link.id);
    // Interleave every entry point. The first ten attempts share one budget.
    for (let i = 0; i < 10; i++) {
      if (i % 3 === 0) await checked(request("GET", "/" + prefix, undefined, undefined, { Authorization: "Basic " + Buffer.from("u:wrong-secret").toString("base64") }));
      else if (i % 3 === 1) await checked(request("HEAD", "/" + prefix, undefined, undefined, { Authorization: "Basic " + Buffer.from("u:wrong-secret").toString("base64") }));
      else await checked(request("POST", (i % 2 ? "/api" : "/API/V2") + "/LiNkS/" + link.id + "/PrOtEcTeD", { password: "wrong-secret" }), 401);
    }
    for (const api of ["/api", "/API/V2"]) await checked(request("POST", api + "/links/" + link.id + "/protected", { password: "protected-secret" }), 429);
    for (const method of ["GET", "HEAD"]) await checked(request(method, "/" + prefix, undefined, undefined, { Authorization: "Basic " + Buffer.from("u:protected-secret").toString("base64") }), 429);
    // Merely showing the form is not a password attempt.
    await checked(request("GET", "/" + prefix));

    code(`
      const calls = [];
      require(${JSON.stringify(path.join(root, "node_modules/nodemailer"))}).createTransport = () => ({sendMail: async value => { calls.push(value); return {accepted:['test@example.invalid']}; }});
      const mail = require(${JSON.stringify(path.join(root, "server/mail"))});
      const user = {email:'test@example.invalid', change_email_address:'new@example.invalid', verification_token:'VERIFY_TEST', change_email_token:'EMAIL_TEST', reset_password_token:'RESET_TEST'};
      await mail.verification(user); await mail.changeEmail(user); await mail.resetPasswordToken(user);
      for (const value of calls) {
        const urls = [...value.html.matchAll(/href="([^"]+)"/g)].map(m=>m[1]).filter(url=>/VERIFY_TEST|EMAIL_TEST|RESET_TEST/.test(url));
        assert.equal(urls.length,2,'Normal and Outlook action URLs both present');
        assert(urls.every(url=>url.startsWith('https://')));
      }
      const input = 'https://test.invalid/#<img src=x onerror=alert(1)>';
      await mail.sendReportEmail(input);
      assert.equal(calls[3].text,input); assert.equal(calls[3].html,undefined);
    `, { MAIL_ENABLED: "true" });

    code(`
      const bcrypt = require(${JSON.stringify(path.join(root, "node_modules/bcryptjs"))});
      const auth = require(${JSON.stringify(path.join(root, "server/handlers/auth.handler"))});
      const originalHash = bcrypt.hash; let calls = 0;
      bcrypt.hash = (...args) => { if (args.length < 3) calls++; return originalHash(...args); };
      const body = {new_password:'Reset-test-only-password', reset_password_token:${JSON.stringify(randomUUID())}};
      await assert.rejects(()=>auth.newPassword({body},{render(){}}));
      assert.equal(calls,0,'Invalid tokens rejected before expensive hashing');
      const query = require(${JSON.stringify(path.join(root, "server/queries/user.queries"))});
      const email = ${JSON.stringify(prefix + "@example.invalid")};
      await knex('users').insert({email,password:'old-hash',reset_password_token:body.reset_password_token,reset_password_expires:'2099-01-01 00:00:00'});
      const before = await knex('users').where({email}).first();
      let guarded = false;
      knex.on('query',event=>{ if (/update.*users/i.test(event.sql) && event.sql.includes('reset_password_token')) guarded = /where.*reset_password_token.*reset_password_expires/i.test(event.sql); });
      await auth.newPassword({body},{render(){}});
      assert.equal(calls,1); assert(guarded,'Consumption predicates retained on the UPDATE');
      const after = await knex('users').where({email}).first();
      assert.equal(after.reset_password_token,null); assert.equal(after.auth_version,before.auth_version+1);
      assert(await bcrypt.compare(body.new_password,after.password));
      await assert.rejects(()=>auth.newPassword({body},{render(){}})); assert.equal(calls,1);
      assert.equal(await query.update({reset_password_token:body.reset_password_token},{password:'must-not-write'}),undefined);
      assert.equal((await knex('users').where({email}).first()).password,after.password);
    `);

    code(`
      const refs = require(${JSON.stringify(path.join(root, "server/analytics-referrers"))});
      let value = '{}';
      for (let i=0;i<11000;i++) value = refs.append(value,'ref'+i+'[dot]invalid');
      const values=JSON.parse(value); assert(Object.keys(values).length<=129); assert.equal(Object.values(values).reduce((a,b)=>a+b,0),11000);
      const historical=JSON.stringify(Object.fromEntries(Array.from({length:11000},(_,i)=>['r'+i+'[dot]invalid',1])));
      const map=new Map(refs.entries(historical,11000)); assert(map.size<=129); assert.equal([...map.values()].reduce((a,b)=>a+b,0),11000);
      const oversized=JSON.stringify({['x'.repeat(1000001)]:17});
      assert.deepEqual(refs.entries(oversized,18),[['(other)',18]]); assert.equal(refs.append(oversized,'new'),oversized);
      await knex('visits').insert({link_id:${original.id},user_id:${owner.id},total:11000,referrers:historical,countries:JSON.stringify({fr:11000})});
    `);
    const reports = async () => {
      const result = await checked(request("GET", "/api/analytics?link=" + link.id, undefined, session));
      assert.equal(result.total, 11000); assert(result.stats.referrer.length <= 129);
      assert.equal(result.stats.referrer.reduce((n, row) => n + row.visits, 0), 11000);
      await checked(request("GET", "/api/links/" + link.id + "/stats", undefined, session));
    };
    await reports();
    const oversized = JSON.stringify({ ["h".repeat(1000001)]: 11000 });
    db.prepare("UPDATE visits SET referrers=? WHERE link_id=?").run(oversized, original.id);
    await reports(); assert.equal(db.prepare("SELECT referrers FROM visits WHERE link_id=?").get(original.id).referrers, oversized);

    env.ENABLE_RATE_LIMIT = "true"; await restart();
    for (const origin of ["https://evil.invalid", "null", "https://" + env.DEFAULT_DOMAIN + "/not-an-origin"]) {
      await checked(request("POST", "/api/auth/login", account, undefined, { Origin: origin }), 403);
    }
    await checked(request("POST", "/api/auth/login", account, undefined, { "Sec-Fetch-Site": "cross-site" }), 403);
    const aliases = ["/api/auth/login", "/API/AUTH/LOGIN", "/api/v2/auth/login", "/Api/V2/Auth/LoGiN", "/api/auth/LOGIN/"];
    for (const pathname of aliases) await checked(request("POST", pathname, { ...account, password: "wrong-password" }), 401);
    await checked(request("POST", "/api/v2/auth/LOGIN", account), 429);
    const body = { reset_password_token: randomUUID(), new_password: "test-new-password", repeat_password: "test-new-password" };
    for (const pathname of aliases) await checked(request("POST", pathname.replace(/login/i, "new-password"), body), 400);
    await checked(request("POST", "/API/V2/AUTH/NEW-PASSWORD", body), 429);
    console.log("PASS: retention browser-only access, omitted-password preservation, shared protected-link throttle, domain ban, HTTPS email buttons, text-only reports, single-use reset, bounded referrers and auth alias/origin controls");
  } finally {
    db.prepare("UPDATE users SET apikey=? WHERE id=?").run(owner.apikey, owner.id);
    db.close(); env.ENABLE_RATE_LIMIT = "false"; await restart();
  }
};
