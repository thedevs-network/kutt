import { combineReducers } from 'redux';
import * as types from '../actions/actionTypes';

const initialState = {
  list: [],
  isShortened: false,
  count: 10,
  countAll: 0,
  page: 1,
  search: '',
};

const url = (state = initialState, action) => {
  const { count, page, search } = action.payload || {};
  const isSearch = typeof search !== 'undefined';
  switch (action.type) {
    case types.ADD_URL:
      return { ...state, isShortened: true, list: [action.payload, ...state.list] };
    case types.UPDATE_URL_LIST:
      return Object.assign({}, state, count && { count }, page && { page }, isSearch && { search });
    case types.LIST_URLS:
      return {
        ...state,
        list: action.payload.list,
        countAll: action.payload.countAll,
        isShortened: false,
      };
    case types.DELETE_URL:
      return { ...state, list: state.list.filter(item => item.id !== action.payload) };
    case types.UNAUTH_USER:
      return initialState;
    default:
      return state;
  }
};

/* All errors */
const errorInitialState = {
  auth: '',
  domain: '',
  shortener: '',
};

const error = (state = errorInitialState, action) => {
  switch (action.type) {
    case types.SHORTENER_ERROR:
      return { ...state, shortener: action.payload };
    case types.DOMAIN_ERROR:
      return { ...state, domain: action.payload };
    case types.SET_DOMAIN:
      return { ...state, domain: '' };
    case types.SHOW_DOMAIN_INPUT:
      return { ...state, domain: '' };
    case types.ADD_URL:
      return { ...state, shortener: '' };
    case types.UPDATE_URL:
      return { ...state, urlOptions: '' };
    case types.AUTH_ERROR:
      return { ...state, auth: action.payload };
    case types.AUTH_USER:
      return { ...state, auth: '' };
    case types.HIDE_PAGE_LOADING:
      return {
        ...state,
        auth: '',
        shortener: '',
        urlOptions: '',
      };
    default:
      return state;
  }
};

/* All loadings */
const loadingInitialState = {
  api: false,
  domain: false,
  shortener: false,
  login: false,
  page: false,
  table: false,
  signup: false,
};

const loading = (state = loadingInitialState, action) => {
  switch (action.type) {
    case types.SHOW_PAGE_LOADING:
      return { ...state, page: true };
    case types.HIDE_PAGE_LOADING:
      return {
        shortener: false,
        login: false,
        page: false,
        signup: false,
      };
    case types.TABLE_LOADING:
      return { ...state, table: true };
    case types.LOGIN_LOADING:
      return { ...state, login: true };
    case types.SIGNUP_LOADING:
      return { ...state, signup: true };
    case types.SHORTENER_LOADING:
      return { ...state, shortener: true };
    case types.ADD_URL:
      return { ...state, shortener: false };
    case types.SHORTENER_ERROR:
      return { ...state, shortener: false };
    case types.LIST_URLS:
      return { ...state, table: false };
    case types.DELETE_URL:
      return { ...state, table: false };
    case types.AUTH_ERROR:
      return { ...state, login: false, signup: false };
    case types.AUTH_USER:
      return { ...state, login: false, signup: false };
    case types.DOMAIN_LOADING:
      return { ...state, domain: true };
    case types.SET_DOMAIN:
      return { ...state, domain: false };
    case types.DOMAIN_ERROR:
      return { ...state, domain: false };
    case types.API_LOADING:
      return { ...state, api: true };
    case types.SET_APIKEY:
      return { ...state, api: false };
    default:
      return state;
  }
};

/* User authentication */
const authInitialState = {
  isAuthenticated: false,
  sentVerification: false,
  user: '',
  renew: false,
};

const auth = (state = authInitialState, action) => {
  switch (action.type) {
    case types.AUTH_USER:
      return {
        ...state,
        isAuthenticated: true,
        user: action.payload,
        sentVerification: false,
      };
    case types.AUTH_RENEW:
      return { ...state, renew: true };
    case types.UNAUTH_USER:
      return authInitialState;
    case types.SENT_VERIFICATION:
      return { ...state, sentVerification: true, user: action.payload };
    default:
      return state;
  }
};

/* Settings */
const settingsInitialState = {
  apikey: '',
  customDomain: '',
  domainInput: true,
};

const settings = (state = settingsInitialState, action) => {
  switch (action.type) {
    case types.SET_DOMAIN:
      return { ...state, customDomain: action.payload, domainInput: false };
    case types.SET_APIKEY:
      return { ...state, apikey: action.payload };
    case types.DELETE_DOMAIN:
      return { ...state, customDomain: '', domainInput: true };
    case types.SHOW_DOMAIN_INPUT:
      return { ...state, domainInput: true };
    case types.UNAUTH_USER:
      return settingsInitialState;
    default:
      return state;
  }
};

const rootReducer = combineReducers({
  auth,
  error,
  loading,
  settings,
  url,
});

export default rootReducer;
