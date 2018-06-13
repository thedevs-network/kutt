import {
  SHOW_PAGE_LOADING,
  HIDE_PAGE_LOADING,
  TABLE_LOADING,
  LOGIN_LOADING,
  SIGNUP_LOADING,
  SHORTENER_LOADING,
  ADD_URL,
  SHORTENER_ERROR,
  LIST_URLS,
  DELETE_URL,
  AUTH_ERROR,
  AUTH_USER,
  DOMAIN_LOADING,
  SET_DOMAIN,
  DOMAIN_ERROR,
  API_LOADING,
  SET_APIKEY,
} from '../actions/actionTypes';

const initialState = {
  api: false,
  domain: false,
  shortener: false,
  login: false,
  page: false,
  table: false,
  signup: false,
};

const loading = (state = initialState, action) => {
  switch (action.type) {
    case SHOW_PAGE_LOADING:
      return { ...state, page: true };
    case HIDE_PAGE_LOADING:
      return {
        shortener: false,
        login: false,
        page: false,
        signup: false,
      };
    case TABLE_LOADING:
      return { ...state, table: true };
    case LOGIN_LOADING:
      return { ...state, login: true };
    case SIGNUP_LOADING:
      return { ...state, signup: true };
    case SHORTENER_LOADING:
      return { ...state, shortener: true };
    case ADD_URL:
    case SHORTENER_ERROR:
      return { ...state, shortener: false };
    case LIST_URLS:
    case DELETE_URL:
      return { ...state, table: false };
    case AUTH_ERROR:
    case AUTH_USER:
      return { ...state, login: false, signup: false };
    case DOMAIN_LOADING:
      return { ...state, domain: true };
    case SET_DOMAIN:
    case DOMAIN_ERROR:
      return { ...state, domain: false };
    case API_LOADING:
      return { ...state, api: true };
    case SET_APIKEY:
      return { ...state, api: false };
    default:
      return state;
  }
};

export default loading;
