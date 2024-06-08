import { Knex } from "knex";
import bcrypt from "bcryptjs";

export async function seed(knex: Knex): Promise<void> {
  // Deletes ALL existing entries
  await knex("users").del();

  const salt = await bcrypt.genSalt(12);
  const password = await bcrypt.hash("password", salt);

  // Inserts seed entries
  await knex("users").insert([
    { id: 1, email: "atk@kutt.app", password: password, verified: true }
  ]);
}
