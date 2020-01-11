import { action, Action, thunk, Thunk } from "easy-peasy";
import axios from "axios";

import { getAxiosConfig } from "../utils";
import { StoreModel } from "./store";
import { API } from "../consts";

export interface Domain {
  customDomain: string;
  homepage: string;
}

export interface SettingsResp extends Domain {
  apikey: string;
}

export interface Settings {
  domains: Array<Domain>;
  apikey: string;
  fetched: boolean;
  setSettings: Action<Settings, SettingsResp>;
  getSettings: Thunk<Settings, null, null, StoreModel>;
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
  fetched: false,
  getSettings: thunk(async (actions, payload, { getStoreActions }) => {
    getStoreActions().loading.show();
    const res = await axios.get(API.SETTINGS, getAxiosConfig());
    actions.setSettings(res.data);
    getStoreActions().loading.hide();
  }),
  generateApiKey: thunk(async actions => {
    const res = await axios.post(API.GENERATE_APIKEY, null, getAxiosConfig());
    actions.setApiKey(res.data.apikey);
  }),
  deleteDomain: thunk(async actions => {
    await axios.delete(API.CUSTOM_DOMAIN, getAxiosConfig());
    actions.removeDomain();
  }),
  setSettings: action((state, payload) => {
    state.apikey = payload.apikey;
    state.fetched = true;
    if (payload.customDomain) {
      state.domains = [
        {
          customDomain: payload.customDomain,
          homepage: payload.homepage
        }
      ];
    }
  }),
  setApiKey: action((state, payload) => {
    state.apikey = payload;
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
  })
};
