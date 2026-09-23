const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { performance } = require('node:perf_hooks');

async function main() {
  assert.equal(process.env.KUTT_PROFILE_DISPOSABLE, '1');
  assert.equal(process.cwd(), '/kutt');
  assert(!fs.existsSync('/kutt/.env'));
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'kutt-visit-profile-'));
  Object.assign(process.env, { NODE_ENV: 'production', DEFAULT_DOMAIN: 'profile.invalid',
    DB_CLIENT: 'better-sqlite3', DB_FILENAME: path.join(directory, 'profile.sqlite'),
    JWT_SECRET: randomUUID() + randomUUID(), REDIS_ENABLED: 'false', MAIL_ENABLED: 'false',
    OIDC_ENABLED: 'false', NODE_APP_INSTANCE: '1' });
  const db = require('/kutt/server/knex');
  try {
    await db.migrate.latest({ directory: '/kutt/server/migrations' });
    await db('users').insert({ id: 1, email: 'profile@example.invalid', password: 'unused', role: 'ADMIN', verified: true });
    await db('links').insert({ id: 1, uuid: randomUUID(), address: 'profile', target: 'https://192.0.2.1/', user_id: 1 });
    const start = Date.UTC(2020, 0, 1);
    for (let offset = 0; offset < 25000; offset += 100) {
      await db('visits').insert(Array.from({ length: 100 }, (_, index) => ({ link_id: 1, user_id: 1,
        created_at: new Date(start + (offset + index) * 3600000).toISOString().slice(0, 19).replace('T', ' '),
        total: 1, countries: '{"fr":1}', referrers: '{"direct":1}' })));
    }
    await db('links').where({ id: 1 }).update({ visit_count: 25000 });
    const utils = require('/kutt/server/utils');
    const indexMigration = require('/kutt/server/migrations/20260922090000_visit_hour_lookup');
    await indexMigration.down(db);
    const hour = new Date().toISOString().slice(0, 13).replace('T', ' ') + ':00:00';
    const end = new Date(new Date(hour.replace(' ', 'T') + 'Z').getTime() + 3600000).toISOString().slice(0, 19).replace('T', ' ');
    const legacy = () => db.select('*').from(db('visits').select('visits.*').select({ created_at_hours: db.raw('strftime(?, ??)', ['%Y-%m-%d %H:00:00', 'created_at']) }).where({ link_id: 1 }).as('subquery')).where('created_at_hours', hour).first();
    const range = () => db('visits').where({ link_id: 1 }).where('created_at', '>=', hour).where('created_at', '<', end).first();
    const measure = async operation => {
      const samples = [];
      for (let index = 0; index < 100; index++) { const start = performance.now(); await operation(); samples.push(performance.now() - start); }
      samples.sort((a, b) => a - b);
      return { median_ms: samples[50], p95_ms: samples[95], max_ms: samples.at(-1) };
    };
    const plan = async query => { const sql = query.toSQL(); return db.raw('EXPLAIN QUERY PLAN ' + sql.sql, sql.bindings); };
    const report = { rows: 25000, node: process.version, image_version: require('/kutt/package.json').version,
      lookup: { legacy: await measure(legacy), range: await measure(range) },
      plans: { legacy: await plan(legacy()), range: await plan(range()) } };
    await indexMigration.up(db);
    const indexed = () => db.select('*').from(db('visits').select('visits.*').select({ created_at_hours: utils.truncatedCreatedAtHour }).where({ link_id: 1 }).as('subquery')).where('created_at_hours', hour).first();
    report.lookup.indexed_hour = await measure(indexed);
    report.plans.indexed_hour = await plan(indexed());
    const add = require('/kutt/server/queries/visit.queries').add;
    const job = { browser: 'safari', os: 'ios', country: 'FR', referrer: 'direct', link_id: 1, user_id: 1, tracking_revision: 0 };
    report.aggregate = await measure(() => add(job));
    await Promise.all(Array.from({ length: 16 }, () => add(job)));
    const link = await db('links').where({ id: 1 }).first();
    const total = await db('visits').where({ link_id: 1 }).sum({ total: 'total' }).first();
    assert.equal(Number(link.visit_count), 25116);
    assert.equal(Number(total.total), 25116);
    report.exact_counts = true;
    console.log(JSON.stringify(report, null, 2));
  } finally { await db.destroy(); fs.rmSync(directory, { recursive: true, force: true }); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
