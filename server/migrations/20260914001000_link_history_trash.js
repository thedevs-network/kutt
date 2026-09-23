const { createHash } = require("node:crypto");
const env = require("../env");

async function up(knex) {
  await knex.schema.alterTable("links", table => {
    table.bigInteger("deleted_at").nullable().index();
    table.string("archived_domain").nullable();
  });
  await knex.schema.createTable("link_alias_claims", table => {
    table.string("key", 64).primary();
    table.string("domain").notNullable();
    table.string("address").notNullable();
    // No FK: deleting an account must not make its previously issued URLs reusable.
    table.uuid("link_uuid").notNullable().index();
    table.bigInteger("retired_at").nullable();
  });
  await knex.schema.createTable("link_history", table => {
    table.increments("id").primary();
    table.integer("link_id").unsigned().notNullable().references("id").inTable("links").onDelete("CASCADE");
    table.integer("actor_id").unsigned().nullable().references("id").inTable("users").onDelete("SET NULL");
    table.string("source", 20).notNullable();
    table.string("action", 30).notNullable();
    table.text("fields").notNullable();
    table.bigInteger("created_at").notNullable();
    table.index(["link_id", "id"]);
  });
  // Bounded batches avoid holding the complete link inventory in memory.
  let after = 0;
  while (true) {
    const links = await knex("links").select("links.id", "links.uuid", "links.address", "domains.address as domain")
      .leftJoin("domains", "links.domain_id", "domains.id").where("links.id", ">", after).orderBy("links.id").limit(500);
    if (!links.length) break;
    for (const link of links) {
      const domain = (link.domain || env.DEFAULT_DOMAIN).toLowerCase();
      const key = createHash("sha256").update(domain + "\0" + link.address).digest("hex");
      // Duplicate historical aliases fail migration, never silently pick an owner.
      await knex("link_alias_claims").insert({ key, domain, address: link.address, link_uuid: link.uuid });
      await knex("link_history").insert({ link_id: link.id, source: "system", action: "migrated", fields: "[]", created_at: Date.now() });
    }
    after = links.at(-1).id;
  }
}

async function down(knex) {
  if (await knex("links").whereNotNull("deleted_at").orWhereNotNull("archived_domain").first() ||
      await knex("link_alias_claims").whereNotNull("retired_at").first() ||
      await knex("link_alias_claims").leftJoin("links", "links.uuid", "link_alias_claims.link_uuid").whereNull("links.id").first() ||
      await knex("link_history").whereNot("action", "migrated").first()) {
    throw new Error("Cannot discard trash, retired aliases or link history. Keep this schema and use a compatible image.");
  }
  await knex.schema.dropTable("link_history");
  await knex.schema.dropTable("link_alias_claims");
  await knex.schema.alterTable("links", table => {
    table.dropColumn("deleted_at");
    table.dropColumn("archived_domain");
  });
}

module.exports = { up, down };
