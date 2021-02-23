import query from "../queries";
import * as utils from "../utils";
import { Handler } from "express";

export const get = async (req, res) => {
  const domains = await query.domain.get({ user_id: req.user.id });

  const data = {
    apikey: req.user.apikey,
    email: req.user.email,
    domains: domains.map(utils.sanitize.domain)
  };

  return res.status(200).send(data);
};

export const getUserList: Handler = async (req, res) => {
  const { limit, skip, search } = req.query;

  const [users, total] = await Promise.all([
    query.user.findAll({ limit, search, skip }),
    query.user.total()
  ]);

  const data = users.map(user => {
    return {
      banned: user.banned,
      created_at: user.created_at,
      email: user.email,
      id: user.id,
      updated_at: user.updated_at,
      verified: user.verified
    };
  });

  return res.send({
    total,
    limit,
    skip,
    data
  });
};

export const remove = async (req, res) => {
  await query.user.remove(req.user);
  return res.status(200).send("OK");
};

export const ban = async (req, res) => {
  const { id } = req.params;

  const update = {
    banned_by_id: req.user.id,
    banned: true
  };

  await query.user.update({ id: id }, update);
  return res.status(200).send("OK");
};

export const removeById = async (req, res) => {
  const { id } = req.params;

  await query.user.removeById(id);
  return res.status(200).send("OK");
};
