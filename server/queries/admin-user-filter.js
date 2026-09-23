const knex = require("../knex");

module.exports = function filterAdminUser(query, column, value) {
  if (value === undefined || value === "") return query;
  if (typeof value !== "string") return query.whereRaw("1 = 0");
  const filter = value.trim();
  if (!filter) return query;
  if (/^\d+$/.test(filter)) {
    const id = Number(filter);
    return Number.isSafeInteger(id) && id > 0
      ? query.andWhere(column, id)
      : query.whereRaw("1 = 0");
  }
  return query[knex.compatibleILIKE]("users.email", "%" + filter + "%");
};
