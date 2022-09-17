import * as Knex from "knex";
import env from "../env";
import * as models from "../models";

const changeTableName = async (
  knex: Knex,
  oldName: string,
  newName: string
) => {
  if (oldName.trim() === newName.trim()) return;
  return knex.raw(`
        ALTER TABLE ${oldName} RENAME TO ${newName}
    `);
};

export async function up(knex: Knex): Promise<any> {
  const { TableName } = models;

  // IP
  TableName.setPrefix("");
  await changeTableName(
    knex,
    (() => {
      TableName.setPrefix("");
      return TableName.ip;
    })(),
    (() => {
      TableName.setPrefix(env.DB_PREFIX_TABLE);
      return TableName.ip;
    })()
  );

  // Visit
  TableName.setPrefix("");
  await changeTableName(
    knex,
    (() => {
      TableName.setPrefix("");
      return TableName.visit;
    })(),
    (() => {
      TableName.setPrefix(env.DB_PREFIX_TABLE);
      return TableName.visit;
    })()
  );

  // Link
  TableName.setPrefix("");
  await changeTableName(
    knex,
    (() => {
      TableName.setPrefix("");
      return TableName.link;
    })(),
    (() => {
      TableName.setPrefix(env.DB_PREFIX_TABLE);
      return TableName.link;
    })()
  );

  // Domain
  TableName.setPrefix("");
  await changeTableName(
    knex,
    (() => {
      TableName.setPrefix("");
      return TableName.domain;
    })(),
    (() => {
      TableName.setPrefix(env.DB_PREFIX_TABLE);
      return TableName.domain;
    })()
  );
  // Host
  TableName.setPrefix("");
  await changeTableName(
    knex,
    (() => {
      TableName.setPrefix("");
      return TableName.host;
    })(),
    (() => {
      TableName.setPrefix(env.DB_PREFIX_TABLE);
      return TableName.host;
    })()
  );

  // User
  TableName.setPrefix("");
  await changeTableName(
    knex,
    (() => {
      TableName.setPrefix("");
      return TableName.user;
    })(),
    (() => {
      TableName.setPrefix(env.DB_PREFIX_TABLE);
      return TableName.user;
    })()
  );
}

export async function down(knex: Knex): Promise<any> {
  // do nothing
}
