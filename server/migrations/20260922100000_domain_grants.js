exports.up = async db => {
  await db.schema.createTable("domain_access_state", table => {
    table.integer("id").primary();
    table.bigInteger("sequence").notNullable().defaultTo(0);
  });
  await db("domain_access_state").insert({ id: 1 });
  await db.schema.createTable("domain_grants", table => {
    table.uuid("id").primary();
    table.integer("domain_id").unsigned().notNullable().references("id").inTable("domains").onDelete("CASCADE");
    table.integer("user_id").unsigned().notNullable().references("id").inTable("users").onDelete("CASCADE");
    table.integer("granted_by_id").unsigned().nullable().references("id").inTable("users").onDelete("SET NULL");
    table.bigInteger("created_at").notNullable();
    table.unique(["domain_id", "user_id"]);
    table.index("user_id");
  });
};
exports.down = async db => {
  if (await db("domain_grants").first()) throw new Error("Revoke domain grants before removing their authorization boundary.");
  await db.schema.dropTable("domain_grants");
  await db.schema.dropTable("domain_access_state");
};
