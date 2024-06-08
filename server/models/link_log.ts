import { Knex } from "knex";

export async function createLinkLogTable(knex: Knex) {
  const hasTable = await knex.schema.hasTable("link_logs");

  if (!hasTable) {
    await knex.schema.raw('create extension if not exists "uuid-ossp"');
    await knex.schema.createTable("link_logs", (table) => {
      knex.raw('create extension if not exists "uuid-ossp"');
      table.increments("id").primary(); // log id
      table
        .integer("link_id")
        .references("id")
        .inTable("links")
        .onDelete("CASCADE");
      table.string("action").notNullable().defaultTo("create");
      table.string("address").notNullable();
      table.string("description");
      table.boolean("banned").notNullable().defaultTo(false);
      table.integer("banned_by_id").references("id").inTable("users");
      table.integer("domain_id").references("id").inTable("domains");
      table.string("password");
      table.dateTime("expire_in");
      table.string("target", 2040).notNullable();
      table
        .integer("user_id")
        .references("id")
        .inTable("users")
        .onDelete("CASCADE");
      table.integer("visit_count").notNullable().defaultTo(0);
      table.timestamps(false, true);
    });
  }

  const hasUUID = await knex.schema.hasColumn("link_logs", "uuid");
  if (!hasUUID) {
    await knex.schema.raw('create extension if not exists "uuid-ossp"');
    await knex.schema.alterTable("link_logs", (table) => {
      table
        .uuid("uuid")
        .notNullable()
        .defaultTo(knex.raw("uuid_generate_v4()"));
    });
  }
}

export async function createLinkLogTrigger(knex: Knex) {
  await knex.schema.raw(`
    DROP TRIGGER IF EXISTS log_link_insert ON links;
    DROP TRIGGER IF EXISTS log_link_update ON links;
    DROP FUNCTION IF EXISTS log_link;
  `);

  await knex.schema.raw(`
    CREATE OR REPLACE FUNCTION log_link() RETURNS TRIGGER AS $$
    BEGIN
      INSERT INTO link_logs (
        link_id,
        action,
        address,
        description,
        banned,
        banned_by_id,
        domain_id,
        password,
        expire_in,
        target,
        user_id,
        visit_count,
        created_at,
        updated_at,
        uuid
      )
      VALUES (
        NEW.id,
        TG_ARGV[0],
        NEW.address,
        NEW.description,
        NEW.banned,
        NEW.banned_by_id,
        NEW.domain_id,
        NEW.password,
        NEW.expire_in,
        NEW.target,
        NEW.user_id,
        NEW.visit_count,
        NEW.created_at,
        NEW.updated_at,
        NEW.uuid
      );
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  await knex.schema.raw(`
    CREATE TRIGGER log_link_insert
    AFTER INSERT ON links
    FOR EACH ROW
    EXECUTE FUNCTION log_link('create');
  `);

  await knex.schema.raw(`
    CREATE TRIGGER log_link_update
    AFTER UPDATE ON links
    FOR EACH ROW
    EXECUTE FUNCTION log_link('update');
  `);
}
