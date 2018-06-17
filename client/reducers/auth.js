import { AUTH_USER, AUTH_RENEW, UNAUTH_USER, SENT_VERIFICATION } from '../actions/actionTypes';

const initialState = {
  isAuthenticated: false,
  sentVerification: false,
  user: '',
  renew: false,
};

const auth = (state = initialState, action) => {
  switch (action.type) {
    case AUTH_USER:
      return {
        ...state,
        isAuthenticated: true,
        user: action.payload,
        sentVerification: false,
      };
    case AUTH_RENEW:
      return { ...state, renew: true };
    case UNAUTH_USER:
      return initialState;
    case SENT_VERIFICATION:
      return { ...state, sentVerification: true, user: action.payload };
    default:
      return state;
  }
};

export default auth;
