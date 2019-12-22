import { action, Action, thunk, Thunk } from "easy-peasy";
import axios from "axios";

import { API } from "../consts";
import { getAxiosConfig } from "../utils";

interface Domain {
  customDomain: string;
  homepage: string;
}

export interface Settings {
  domains: Array<Domain>;
  apikey: string;
  setApiKey: Action<Settings, string>;
  generateApiKey: Thunk<Settings>;
  addDomain: Action<Settings, Domain>;
  removeDomain: Action<Settings>;
  saveDomain: Thunk<Settings, Domain>;
  deleteDomain: Thunk<Settings>;
}

export const settings: Settings = {
  domains: [],
  apikey: null,
  setApiKey: action((state, payload) => {
    state.apikey = payload;
  }),
  generateApiKey: thunk(async actions => {
    const res = await axios.post(API.GENERATE_APIKEY, null, getAxiosConfig());
    actions.setApiKey(res.data.apikey);
  }),
  addDomain: action((state, payload) => {
    state.domains.push(payload);
  }),
  removeDomain: action(state => {
    state.domains = [];
  }),
  saveDomain: thunk(async (actions, payload) => {
    const res = await axios.post(API.CUSTOM_DOMAIN, payload, getAxiosConfig());
    actions.addDomain({
      customDomain: res.data.customDomain,
      homepage: res.data.homepage
    });
  }),
  deleteDomain: thunk(async actions => {
    await axios.delete(API.CUSTOM_DOMAIN, getAxiosConfig());
    actions.removeDomain();
  })
};
