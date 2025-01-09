/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
async function up(knex) {
  const hasUserIDColumn = await knex.schema.hasColumn("visits", "user_id");

  if (hasUserIDColumn) return;

  await knex.schema.alterTable("visits", function(table) {
    table
      .integer("user_id")
      .unsigned();
    table
      .foreign("user_id")
      .references("id")
      .inTable("users")
      .onDelete("CASCADE")
      .withKeyName("visits_user_id_foreign");
  });

  const [{ count }] = await knex("visits").count("* as count");

  const count_number = parseInt(count);
  if (Number.isNaN(count_number) || count_number === 0) return;
    
  if (count_number < 1_000_000) {
    const last_visit = await knex("visits").orderBy("id", "desc").first();

    const size = 100_000;
    const loops = Math.floor(last_visit.id / size) + 1;
    
    await Promise.all(
      new Array(loops).fill(null).map((_, i) => {
        return knex("visits")
          .fromRaw(knex.raw("visits v"))
          .update({ user_id: knex.ref("links.user_id") })
          .updateFrom("links")
          .where("links.id", knex.ref("link_id"))
          .andWhereBetween("v.id", [i * size, (i * size) + size]);
      })
    );
  } else {
    console.warn(
      "MIGRATION WARN:" +
      "Skipped adding user_id to visits due to high volume of visits and the potential risk of locking the database.\n" + 
      "Please refer to Kutt's migration guide for more information."
    );
  } 
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
async function down(knex) {};

module.exports = {
  up, 
  down,
}