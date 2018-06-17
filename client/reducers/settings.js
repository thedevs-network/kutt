import {
  SET_DOMAIN,
  SET_APIKEY,
  DELETE_DOMAIN,
  SHOW_DOMAIN_INPUT,
  UNAUTH_USER,
} from '../actions/actionTypes';

const initialState = {
  apikey: '',
  customDomain: '',
  domainInput: true,
};

const settings = (state = initialState, action) => {
  switch (action.type) {
    case SET_DOMAIN:
      return { ...state, customDomain: action.payload, domainInput: false };
    case SET_APIKEY:
      return { ...state, apikey: action.payload };
    case DELETE_DOMAIN:
      return { ...state, customDomain: '', domainInput: true };
    case SHOW_DOMAIN_INPUT:
      return { ...state, domainInput: true };
    case UNAUTH_USER:
      return initialState;
    default:
      return state;
  }
};

export default settings;
