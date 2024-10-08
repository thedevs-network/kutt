async function createDomainTable(knex) {
  const hasTable = await knex.schema.hasTable("domains");
  if (!hasTable) {
    await knex.schema.createTable("domains", table => {
      table.increments("id").primary();
      table
        .boolean("banned")
        .notNullable()
        .defaultTo(false);
      table
        .integer("banned_by_id")
        .unsigned()
        .references("id")
        .inTable("users");
      table
        .string("address")
        .unique()
        .notNullable();
      table.string("homepage").nullable();
      table
        .integer("user_id")
        .unsigned();
      table
        .foreign("user_id")
        .references("id")
        .inTable("users")
        .onDelete("SET NULL")
        .withKeyName("domains_user_id_foreign");
      table
        .uuid("uuid")
        .notNullable()
        .defaultTo(knex.fn.uuid());
      table.timestamps(false, true);
      
    });
  }
}

module.exports = {
  createDomainTable
}