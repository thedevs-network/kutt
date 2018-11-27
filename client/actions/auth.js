import Router from 'next/router';
import axios from 'axios';
import cookie from 'js-cookie';
import decodeJwt from 'jwt-decode';
import {
  SET_DOMAIN,
  SHOW_PAGE_LOADING,
  HIDE_PAGE_LOADING,
  AUTH_USER,
  UNAUTH_USER,
  SENT_VERIFICATION,
  AUTH_ERROR,
  LOGIN_LOADING,
  SIGNUP_LOADING,
  AUTH_RENEW,
} from './actionTypes';

const setDomain = payload => ({ type: SET_DOMAIN, payload });

export const showPageLoading = () => ({ type: SHOW_PAGE_LOADING });
export const hidePageLoading = () => ({ type: HIDE_PAGE_LOADING });
export const authUser = payload => ({ type: AUTH_USER, payload });
export const unauthUser = () => ({ type: UNAUTH_USER });
export const sentVerification = payload => ({
  type: SENT_VERIFICATION,
  payload,
});
export const showAuthError = payload => ({ type: AUTH_ERROR, payload });
export const showLoginLoading = () => ({ type: LOGIN_LOADING });
export const showSignupLoading = () => ({ type: SIGNUP_LOADING });
export const authRenew = () => ({ type: AUTH_RENEW });

export const signupUser = payload => async dispatch => {
  dispatch(showSignupLoading());
  try {
    const { data: { email } } = await axios.post('/api/auth/signup', payload);
    dispatch(sentVerification(email));
  } catch ({ response }) {
    dispatch(showAuthError(response.data.error));
  }
};

export const loginUser = payload => async dispatch => {
  dispatch(showLoginLoading());
  try {
    const { data: { token } } = await axios.post('/api/auth/login', payload);
    cookie.set('token', token, { expires: 7 });
    dispatch(authRenew());
    dispatch(authUser(decodeJwt(token)));
    dispatch(setDomain(decodeJwt(token).domain));
    dispatch(showPageLoading());
    Router.push('/');
  } catch ({ response }) {
    dispatch(showAuthError(response.data.error));
  }
};

export const logoutUser = () => dispatch => {
  dispatch(showPageLoading());
  cookie.remove('token');
  dispatch(unauthUser());
  Router.push('/login');
};

export const renewAuthUser = () => async (dispatch, getState) => {
  if (getState().auth.renew) {
    return;
  }

  const options = {
    method: 'POST',
    headers: { Authorization: cookie.get('token') },
    url: '/api/auth/renew',
  };

  try {
    const { data: { token } } = await axios(options);
    cookie.set('token', token, { expires: 7 });
    dispatch(authRenew());
    dispatch(authUser(decodeJwt(token)));
    dispatch(setDomain(decodeJwt(token).domain));
  } catch (error) {
    cookie.remove('token');
    dispatch(unauthUser());
  }
};
