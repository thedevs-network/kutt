import { action, Action, thunk, Thunk } from "easy-peasy";
import axios from "axios";

import { getAxiosConfig } from "../utils";
import { APIv2 } from "../consts";
import query from "query-string";

export interface User {
  id: number;
  banned: boolean;
  created_at: string;
  email: string;
  updated_at: string;
  verified: boolean;
}

export interface UserQuery {
  limit: string;
  skip: string;
  search?: string;
}

export interface UserListResponse {
  data: User[];
  total: number;
  limit: number;
  skip: number;
}

export interface Users {
  users: Array<User>;
  total: number;
  loading: boolean;
  get: Thunk<Users, UserQuery>;
  set: Action<Users, UserListResponse>;
  ban: Thunk<Users, number>;
  remove: Thunk<Users, number>;
  setLoading: Action<Users, boolean>;
}

export const users: Users = {
  users: [],
  total: 0,
  loading: true,
  get: thunk(async (actions, payload) => {
    actions.setLoading(true);
    const res = await axios.get(
      `${APIv2.AdminListUsers}?${query.stringify(payload)}`,
      getAxiosConfig()
    );
    actions.set(res.data);
    actions.setLoading(false);
    return res.data;
  }),
  ban: thunk(async (actions, payload) => {
    actions.setLoading(true);
    const res = await axios.post(
      `${APIv2.AdminDeleteUser}/${payload}/ban`,
      null,
      getAxiosConfig()
    );
    return res.data;
  }),
  remove: thunk(async (actions, payload) => {
    actions.setLoading(true);
    const res = await axios.delete(
      `${APIv2.AdminDeleteUser}/${payload}`,
      getAxiosConfig()
    );
  }),
  set: action((state, payload) => {
    state.users = payload.data;
    state.total = payload.total;
  }),
  setLoading: action((state, payload) => {
    state.loading = payload;
  })
};
