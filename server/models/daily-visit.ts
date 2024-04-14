import { Knex } from "knex";


export async function createDailyVisitTable(knex: Knex) {
    const hasTable = await knex.schema.hasTable("daily_visit");
    // console.log("TRYING TO CREATE A TABLE");
    if (!hasTable) {
      await knex.schema.createTable("daily_visit", table => {
        table.increments("id").primary(); // Primary key, autoincrement
        table.integer("link_id").notNullable(); // Foreign key to link_id
        table.date("date").notNullable().defaultTo(knex.fn.now()); // Current date
        table.integer("visit_count").notNullable().defaultTo(0); // Visit count
        table.timestamp("created_at").defaultTo(knex.fn.now()); // Timestamp for entry creation
        table.timestamp("updated_at").defaultTo(knex.fn.now()); // Timestamp for entry update

        // Ensure the combination of link_id and date is unique
        table.unique(["link_id", "date"]);
      });

      await knex.raw(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ language 'plpgsql';
      
      CREATE TRIGGER update_daily_visit_updated_at
      BEFORE UPDATE ON daily_visit
      FOR EACH ROW
      EXECUTE PROCEDURE update_updated_at_column();
    `
    );
    } 
  }
