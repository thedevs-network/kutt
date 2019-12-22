import { action, Action, thunk, Thunk, computed, Computed } from "easy-peasy";
import Router from "next/router";
import decode from "jwt-decode";
import cookie from "js-cookie";
import axios from "axios";

import { TokenPayload } from "../types";
import { API } from "../consts";

export interface Auth {
  domain?: string;
  email: string;
  isAdmin: boolean;
  isAuthenticated: Computed<Auth, boolean>;
  add: Action<Auth, TokenPayload>;
  logout: Action<Auth>;
  login: Thunk<Auth, { email: string; password: string }>;
}

export const auth: Auth = {
  domain: null,
  email: null,
  isAdmin: false,
  isAuthenticated: computed(s => !!s.email),
  add: action((state, payload) => {
    state.domain = payload.domain;
    state.email = payload.sub;
    state.isAdmin = payload.admin;
  }),
  logout: action(state => {
    cookie.remove("token");
    state.domain = null;
    state.email = null;
    state.isAdmin = false;
    Router.push("/");
  }),
  login: thunk(async (actions, payload) => {
    const res = await axios.post(API.LOGIN, payload);
    const { token } = res.data;
    cookie.set("token", token, { expires: 7 });
    const tokenPayload: TokenPayload = decode(token);
    actions.add(tokenPayload);
    Router.push("/");
  })
};
