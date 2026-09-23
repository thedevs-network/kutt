const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");

module.exports = async function (db) {
  const sorting = require("../server/list-sort");
  const users = require("../server/queries/user.queries");
  const links = require("../server/queries/link.queries");
  const domains = require("../server/queries/domain.queries");
  const library = require("../server/library");
  const prefix = "sort-" + randomUUID().slice(0, 8);
  const owners = [];
  for (const name of ["z", "a", "m"]) owners.push(await users.add({ email: prefix + name + "@example.invalid", password: "isolated-sort-fixture", verified: true }));
  const domainRows = [];
  for (const [n, homepage] of [null, "https://example.org/z", "https://example.org/a"].entries()) {
    const address = prefix + n + ".example.invalid";
    await db("domains").insert({ uuid: randomUUID(), address, homepage, user_id: owners[n].id });
    domainRows.push(await db("domains").where({ address }).first());
  }
  for (const [n, amount] of [2, 10, 0].entries()) {
    for (let i = 0; i < amount; i++) {
      const address = prefix + "-" + n + "-" + i;
      await links.create({ user_id: owners[n].id, domain_id: domainRows[n].id, address, target: "https://example.org/" + (10 - i) });
      await db("links").where({ address }).update({ created_at: "2026-01-01 00:00:00", visit_count: i % 2 ? 10 : 2 });
    }
  }
  const owner = owners[1];
  const original = await links.get({ user_id: owner.id }, { limit: 50, skip: 0 });
  for (const sort of ["id", "created_at", "address", "target", "visit_count"]) {
    for (const direction of ["asc", "desc"]) {
      const compare = (a, b) => {
        const left = a[sort], right = b[sort];
        const order = left < right ? -1 : left > right ? 1 : 0;
        return (direction === "asc" ? order : -order) || b.id - a.id;
      };
      const expected = [...original].sort(compare);
      const params = { sort, direction, limit: 3, skip: 0 };
      const first = await links.get({ user_id: owner.id }, params);
      const second = await links.get({ user_id: owner.id }, { ...params, skip: 3 });
      assert.deepEqual([...first, ...second].map(row => row.id), expected.slice(0, 6).map(row => row.id));
      assert.equal(await links.total({ user_id: owner.id }), 10);
      const admin = await links.getAdmin({}, { ...params, user: String(owner.id) });
      assert.deepEqual(admin.map(row => row.id), expected.slice(0, 3).map(row => row.id));
      const result = await library.list(owner.id, { sort, direction });
      assert.deepEqual(result.data.map(row => row.id), expected.map(row => row.uuid));
      assert.equal(result.total, 10);
      const workspace = await sorting.apply(db("links as l").where({ "l.user_id": owner.id }), params, "workspace");
      assert.deepEqual(workspace.map(row => row.id), expected.map(row => row.id));
    }
  }
  for (const direction of ["asc", "desc"]) {
    const params = { search: prefix, sort: "links_count", direction, limit: 50, skip: 0 };
    const wanted = direction === "asc" ? [0, 2, 10] : [10, 2, 0];
    assert.deepEqual((await users.getAdmin({}, params)).map(row => Number(row.links_count || 0)), wanted);
    assert.deepEqual((await domains.getAdmin({}, params)).map(row => Number(row.links_count || 0)), wanted);
    const homepages = await domains.getAdmin({}, { ...params, sort: "homepage" });
    assert.equal(homepages.at(-1).homepage, null);
    assert.equal(homepages[0].homepage, "https://example.org/" + (direction === "asc" ? "a" : "z"));
    for (const sort of ["id", "created_at", "email"]) assert.equal((await users.getAdmin({}, { ...params, sort })).length, 3);
    for (const sort of ["id", "created_at", "address"]) assert.equal((await domains.getAdmin({}, { ...params, sort })).length, 3);
  }
  assert.deepEqual((await links.get({ user_id: owner.id }, { limit: 50, skip: 0 })).map(row => row.id), original.map(row => row.id));
  for (const input of [{ sort: "" }, { direction: "" }, { sort: ["id"] }, { sort: {} }, { sort: "__proto__" },
    { sort: "constructor" }, { sort: "id desc; DELETE FROM users" }, { direction: "DESC" }, { direction: ["asc"] }, { sort: "email" }]) {
    assert.throws(() => sorting.parse(input), error => error.statusCode === 400);
  }
  assert.throws(() => sorting.parse({ sort: "visit_count" }, "users"), error => error.statusCode === 400);
  console.log("PASS: stable SQL sorting, all fields/directions, tied values, numeric counts, null-last, pagination, scope, unchanged counts/defaults and rejected identifiers");
};
