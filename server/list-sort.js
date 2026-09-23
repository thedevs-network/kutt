const i18n = require("./i18n");
const { CustomError } = require("./utils");

const linkFields = Object.freeze({ id: "id", created_at: "created_at", address: "address", target: "target", visit_count: "visit_count" });
const profiles = Object.freeze({
  links: { table: "links", fields: linkFields },
  workspace: { table: "l", fields: linkFields },
  users: { table: "users", fields: { id: "id", created_at: "created_at", email: "email", links_count: "count" } },
  domains: { table: "domains", fields: { id: "id", created_at: "created_at", address: "address", homepage: "homepage", links_count: "count" } }
});

function parse(input = {}, profile = "links") {
  if (!Object.hasOwn(profiles, profile)) throw new Error("Unknown list sort profile.");
  const sort = input.sort === undefined ? "id" : input.sort;
  const direction = input.direction === undefined ? "desc" : input.direction;
  if (typeof sort !== "string" || !Object.hasOwn(profiles[profile].fields, sort) ||
      typeof direction !== "string" || !["asc", "desc"].includes(direction)) {
    throw new CustomError(i18n.t("sorting.invalid"), 400);
  }
  return { sort, direction };
}

function apply(query, input, profile = "links") {
  const { sort, direction } = parse(input, profile);
  const { table, fields } = profiles[profile];
  const field = fields[sort];
  query.clearOrder();
  if (field === "count") query.orderByRaw(`COALESCE(??, 0) ${direction}`, ["l.links_count"]);
  else {
    const column = table + "." + field;
    if (field === "homepage") query.orderByRaw("CASE WHEN ?? IS NULL THEN 1 ELSE 0 END ASC", [column]);
    query.orderBy(column, direction);
  }
  if (sort !== "id") query.orderBy(table + ".id", "desc");
  return query;
}

module.exports = { parse, apply };
