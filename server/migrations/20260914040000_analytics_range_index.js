exports.up = knex => knex.schema.alterTable("visits", table => {
  table.index(["user_id", "created_at", "link_id"], "visits_owner_range_link_idx");
});
exports.down = knex => knex.schema.alterTable("visits", table => {
  table.dropIndex(["user_id", "created_at", "link_id"], "visits_owner_range_link_idx");
});
