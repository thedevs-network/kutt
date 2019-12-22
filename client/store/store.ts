import { createStore, createTypedHooks } from "easy-peasy";

import { auth, Auth } from "./auth";
import { loading, Loading } from "./loading";
import { settings, Settings } from "./settings";

export interface StoreModel {
  auth: Auth;
  loading: Loading;
  settings: Settings;
}

export const store: StoreModel = {
  auth,
  loading,
  settings
};

const typedHooks = createTypedHooks<StoreModel>();

export const useStoreActions = typedHooks.useStoreActions;
export const useStoreDispatch = typedHooks.useStoreDispatch;
export const useStoreState = typedHooks.useStoreState;

export const initializeStore = (initialState?: StoreModel) =>
  createStore(store, { initialState });
