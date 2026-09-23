exports.up = async db => {
  await db.schema.createTable("oidc_role_policy", table => {
    table.integer("id").primary();
    table.string("fingerprint", 64).notNullable();
    table.integer("protected_user_id").unsigned().notNullable().references("id").inTable("users").onDelete("RESTRICT");
    table.bigInteger("updated_at").notNullable();
  });
  await db.schema.createTable("oidc_role_state", table => {
    table.integer("user_id").unsigned().primary().references("id").inTable("users").onDelete("CASCADE");
    table.string("identity_id", 64).nullable();
    table.string("policy_hash", 64).notNullable();
    table.string("decision", 5).notNullable();
    table.bigInteger("last_iat").notNullable().defaultTo(0);
    table.bigInteger("active_until").notNullable().defaultTo(0);
    table.string("sid", 255).nullable();
  });
  await db.schema.createTable("oidc_role_assertions", table => {
    table.string("id", 64).primary();
    table.bigInteger("expires_at").notNullable().index();
  });
};

exports.down = async db => {
  for (const table of ["oidc_role_policy", "oidc_role_state", "oidc_role_assertions"]) {
    if (await db(table).first()) throw new Error("Preserve OIDC role revocation state. Restore a verified compatible backup instead.");
  }
  await db.schema.dropTable("oidc_role_assertions");
  await db.schema.dropTable("oidc_role_state");
  await db.schema.dropTable("oidc_role_policy");
};
