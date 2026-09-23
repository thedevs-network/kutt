const assert = require("node:assert/strict");
const Database = require("better-sqlite3");
const { randomUUID, randomBytes } = require("node:crypto");
const bcrypt = require("bcryptjs");

module.exports = async ({ request, session, database, account, restart }) => {
  const db = new Database(database), prefix = "moderation-" + randomUUID().slice(0, 8);
  const password = randomBytes(30).toString("hex"), passwordHash = await bcrypt.hash(password, 4);
  const admin = db.prepare("SELECT * FROM users WHERE email=?").get(account.email);
  const createdUsers = [], links = [], domains = [], hosts = [];
  const checked = async (promise, status = 200) => {
    const res = await promise;
    assert.equal(res.status, status, await res.clone().text());
    return res;
  };
  const createUser = role => {
    const email = prefix + createdUsers.length + "@example.invalid";
    const id = Number(db.prepare("INSERT INTO users(email,password,role,verified) VALUES(?,?,?,1)").run(email, passwordHash, role).lastInsertRowid);
    createdUsers.push(id); return { id, email };
  };
  const createDomain = owner => {
    const address = prefix + domains.length + ".example.invalid";
    const id = Number(db.prepare("INSERT INTO domains(address,user_id,homepage) VALUES(?,?,?)").run(address, owner, "https://example.org/preserve").lastInsertRowid);
    domains.push(id); return { id, address };
  };
  const createLink = (owner, domain, target = "https://example.org/private?secret=not-in-audit") => {
    const uuid = randomUUID(), address = prefix + links.length;
    db.prepare("INSERT INTO links(uuid,user_id,domain_id,address,target) VALUES(?,?,?,?,?)").run(uuid, owner, domain, address, target);
    links.push(uuid); return { uuid, address };
  };
  const login = async user => (await (await checked(request("POST", "/api/auth/login", { email: user.email, password }))).json()).token;
  const ban = (entity, id, flags = {}, who = session) => request("POST", "/api/" + { user: "users", domain: "domains", link: "links" }[entity] + "/admin/ban/" + id, flags, who);
  const unban = (entity, id, who = session, body = {}) => request("POST", "/api/moderation/" + entity + "/" + id + "/unban", body, who);
  try {
    await checked(ban("user", admin.id), 409);
    await checked(request("DELETE", "/api/users/admin/" + admin.id, undefined, session), 409);
    const owner = createUser("USER"), ownerSession = await login(owner);
    const domain = createDomain(owner.id), link = createLink(owner.id, domain.id);
    const credential = await (await checked(request("POST", "/api/tokens", { name: prefix, scopes: ["links:read"] }, ownerSession), 201)).json();
    const oldKey = randomBytes(20).toString("hex");
    db.prepare("UPDATE users SET apikey=? WHERE id=?").run(oldKey, owner.id);

    const ownDomain = createDomain(admin.id), ownLink = createLink(admin.id, ownDomain.id);
    const count = () => db.prepare("SELECT COUNT(*) AS n FROM moderation_events").get().n;
    const initial = count();
    await checked(ban("domain", ownDomain.id, { user: true, links: true }), 409);
    assert.equal(db.prepare("SELECT banned FROM domains WHERE id=?").get(ownDomain.id).banned, 0);
    assert.equal(db.prepare("SELECT banned FROM links WHERE uuid=?").get(ownLink.uuid).banned, 0);
    assert.equal(count(), initial, "Failed cascade must roll back the audit too");

    const failedDNS = createLink(owner.id, null, "https://" + prefix + ".invalid/path");
    await checked(ban("link", failedDNS.uuid, { host: true, domain: true, user: true }), 400);
    assert.equal(db.prepare("SELECT banned FROM links WHERE uuid=?").get(failedDNS.uuid).banned, 0);
    assert.equal(count(), initial);
    for (const value of [[true], { value: true }, "yes"]) await checked(ban("user", owner.id, { links: value }), 400);
    await checked(ban("user", owner.id, { unknown: true }), 400);
    await checked(ban("user", owner.id, {}, ownerSession), 401);
    await checked(request("GET", "/api/moderation", undefined, ownerSession), 401);
    await checked(request("POST", "/api/moderation/user/" + owner.id + "/unban", {}, session, { Origin: "https://evil.invalid" }), 403);
    await checked(request("GET", "/api/moderation", undefined, session, { "X-API-Key": credential.token }), 403);
    await checked(request("GET", "/api/moderation?entity=__proto__", undefined, session), 400);

    await checked(ban("user", owner.id, { links: "false", domains: "false" }));
    assert.equal(db.prepare("SELECT banned FROM links WHERE uuid=?").get(link.uuid).banned, 0, 'String "false" must not cascade');
    assert.equal(db.prepare("SELECT banned FROM domains WHERE id=?").get(domain.id).banned, 0);
    for (const headers of [{ "X-API-Key": oldKey }, { "X-API-Key": credential.token }]) await checked(request("GET", "/api/links", undefined, undefined, headers), 401);
    await checked(request("GET", "/api/links", undefined, ownerSession), 401);
    await checked(unban("user", owner.id));
    await checked(request("GET", "/api/links", undefined, ownerSession), 401);
    await checked(request("GET", "/api/links", undefined, undefined, { "X-API-Key": credential.token }), 401);
    await checked(request("GET", "/api/links", undefined, undefined, { "X-API-Key": oldKey }), 401);
    const freshSession = await login(owner);
    await checked(request("GET", "/api/links", undefined, freshSession));

    await checked(ban("user", owner.id, { links: true, domains: true }));
    assert.equal(db.prepare("SELECT banned FROM links WHERE uuid=?").get(link.uuid).banned, 1);
    assert.equal(db.prepare("SELECT banned FROM domains WHERE id=?").get(domain.id).banned, 1);
    await checked(unban("user", owner.id, session, { links: true }), 400);
    await checked(unban("user", owner.id));
    assert.equal(db.prepare("SELECT banned FROM links WHERE uuid=?").get(link.uuid).banned, 1);
    await checked(unban("link", link.uuid));
    assert.equal(db.prepare("SELECT banned FROM domains WHERE id=?").get(domain.id).banned, 1);
    await checked(unban("domain", domain.id));
    const legacyAdmin = randomBytes(20).toString("hex");
    db.prepare("UPDATE users SET apikey=? WHERE id=?").run(legacyAdmin, admin.id);
    await checked(ban("link", failedDNS.uuid, { apikey: legacyAdmin }, undefined));
    await checked(unban("link", failedDNS.uuid, undefined, { apikey: legacyAdmin }));
    db.prepare("UPDATE users SET apikey=? WHERE id=?").run(admin.apikey, admin.id);

    const target = createLink(owner.id, null, "https://" + domain.address + "/destination");
    await checked(ban("link", target.uuid, { domain: true }));
    const unchanged = db.prepare("SELECT * FROM domains WHERE id=?").get(domain.id);
    assert.equal(unchanged.user_id, owner.id); assert.equal(unchanged.homepage, "https://example.org/preserve");
    const base = new URL((await request("GET", "/api/health")).url);
    const publicBan = await new Promise((resolve, reject) => {
      const req = require("node:http").get({ hostname: "127.0.0.1", port: base.port, path: "/" + link.address,
        headers: { Host: domain.address } }, res => { res.resume(); resolve({ status: res.statusCode, location: res.headers.location }); });
      req.setTimeout(5000, () => req.destroy(new Error("Fixture timeout"))); req.on("error", reject);
    });
    assert.equal(publicBan.status, 302); assert.equal(publicBan.location, "/banned");
    const hostLink = createLink(owner.id, null, "https://192.0.2.45/synthetic");
    await checked(ban("link", hostLink.uuid, { host: true }));
    const host = db.prepare("SELECT * FROM hosts WHERE address='192.0.2.45'").get(); hosts.push(host.id);
    assert.equal(host.banned, 1);
    await checked(unban("host", host.id));
    const listing = await (await checked(request("GET", "/api/moderation?entity=link", undefined, session))).json();
    assert(listing.bans.some(row => row.id === target.uuid));
    const audit = JSON.stringify(db.prepare("SELECT * FROM moderation_events").all());
    assert(!audit.includes("not-in-audit") && !audit.includes(oldKey) && !audit.includes(owner.email));
    const confirm = await checked(request("GET", "/admin/moderation/link/" + target.uuid, undefined, session, { Accept: "text/html" }));
    assert.equal(confirm.headers.get("referrer-policy"), "same-origin");
    assert.equal(confirm.headers.get("cache-control"), "no-store");
    assert.match(await confirm.text(), /Related links, domains and accounts keep their own bans/);
    for (const origin of ["null", "https://evil.invalid"]) {
      const denied = await checked(request("POST", "/admin/moderation/link/" + target.uuid, {}, session,
        { Accept: "text/html", Origin: origin }), 403);
      assert.match(await denied.text(), /Invalid request origin/);
      assert.equal(db.prepare("SELECT banned FROM links WHERE uuid=?").get(target.uuid).banned, 1);
    }
    const native = await checked(request("POST", "/admin/moderation/link/" + target.uuid, {}, session, { Accept: "text/html" }), 303);
    assert.equal(native.headers.get("location"), "/admin/moderation?entity=link");
    await restart();
    assert.equal(db.prepare("SELECT banned FROM domains WHERE id=?").get(domain.id).banned, 1);
    await checked(request("GET", "/api/links", undefined, undefined, { "X-API-Key": credential.token }), 401);
    console.log("PASS: atomic moderation, explicit unban, persistent credential revocation, strict flags, authorization, DNS rollback, metadata and private audit");
  } finally {
    for (const uuid of links) db.prepare("DELETE FROM links WHERE uuid=?").run(uuid);
    for (const id of domains) db.prepare("DELETE FROM domains WHERE id=?").run(id);
    for (const id of hosts) db.prepare("DELETE FROM hosts WHERE id=?").run(id);
    for (const id of createdUsers) db.prepare("DELETE FROM users WHERE id=?").run(id);
    db.close();
  }
};
