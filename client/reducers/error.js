import {
  SHORTENER_ERROR,
  DOMAIN_ERROR,
  SET_DOMAIN,
  SHOW_DOMAIN_INPUT,
  ADD_URL,
  UPDATE_URL,
  AUTH_ERROR,
  AUTH_USER,
  HIDE_PAGE_LOADING,
} from '../actions/actionTypes';

const initialState = {
  auth: '',
  domain: '',
  shortener: '',
  urlOptions: '',
};

const error = (state = initialState, action) => {
  switch (action.type) {
    case SHORTENER_ERROR:
      return { ...state, shortener: action.payload };
    case DOMAIN_ERROR:
      return { ...state, domain: action.payload };
    case SET_DOMAIN:
    case SHOW_DOMAIN_INPUT:
      return { ...state, domain: '' };
    case ADD_URL:
      return { ...state, shortener: '' };
    case UPDATE_URL:
      return { ...state, urlOptions: '' };
    case AUTH_ERROR:
      return { ...state, auth: action.payload };
    case AUTH_USER:
      return { ...state, auth: '' };
    case HIDE_PAGE_LOADING:
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

export default error;
