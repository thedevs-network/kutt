import { Knex } from "knex";
import * as models from "../models";

export async function up(knex: Knex): Promise<any> {
  await models.createUserTable(knex);
  await models.createIPTable(knex);
  await models.createDomainTable(knex);
  await models.createHostTable(knex);
  await models.createLinkTable(knex);
  await models.createVisitTable(knex);

  await Promise.all([
    knex.raw(`
      ALTER TABLE domains
      DROP CONSTRAINT domains_user_id_foreign,
      ADD CONSTRAINT domains_user_id_foreign
        FOREIGN KEY (user_id) 
        REFERENCES users (id)
        ON DELETE SET NULL;
    `),
    knex.raw(`
      ALTER TABLE links
      DROP CONSTRAINT links_user_id_foreign,
      ADD CONSTRAINT links_user_id_foreign
        FOREIGN KEY (user_id)
        REFERENCES users (id)
        ON DELETE CASCADE;
    `),
    knex.raw(`
      ALTER TABLE visits
      DROP CONSTRAINT visits_link_id_foreign,
      ADD CONSTRAINT visits_link_id_foreign
        FOREIGN KEY (link_Id)
        REFERENCES links (id)
        ON DELETE CASCADE;
    `)
  ]);
}

export async function down(): Promise<any> {
  // do nothing
}
