import Router from 'next/router';
import axios from 'axios';
import cookie from 'js-cookie';
import decodeJwt from 'jwt-decode';
import * as types from './actionTypes';

/* Homepage input actions */
const addUrl = payload => ({ type: types.ADD_URL, payload });
const listUrls = payload => ({ type: types.LIST_URLS, payload });
const updateUrlList = payload => ({ type: types.UPDATE_URL_LIST, payload });
const deleteUrl = payload => ({ type: types.DELETE_URL, payload });
const showShortenerLoading = () => ({ type: types.SHORTENER_LOADING });
const showTableLoading = () => ({ type: types.TABLE_LOADING });
export const setShortenerFormError = payload => ({ type: types.SHORTENER_ERROR, payload });

export const createShortUrl = params => dispatch => {
  dispatch(showShortenerLoading());
  return axios
    .post('/api/url/submit', params, { headers: { Authorization: cookie.get('token') } })
    .then(({ data }) => dispatch(addUrl(data)))
    .catch(({ response }) => dispatch(setShortenerFormError(response.data.error)));
};

export const getUrlsList = params => (dispatch, getState) => {
  if (params) dispatch(updateUrlList(params));
  dispatch(showTableLoading());
  return axios
    .post('/api/url/geturls', getState().url, { headers: { Authorization: cookie.get('token') } })
    .then(({ data }) => dispatch(listUrls(data)));
};

export const deleteShortUrl = params => dispatch => {
  dispatch(showTableLoading());
  return axios
    .post('/api/url/deleteurl', params, { headers: { Authorization: cookie.get('token') } })
    .then(() => dispatch(deleteUrl(params.id)))
    .catch(({ response }) => dispatch(setShortenerFormError(response.data.error)));
};
/* Page loading actions */
export const showPageLoading = () => ({ type: types.SHOW_PAGE_LOADING });
export const hidePageLoading = () => ({ type: types.HIDE_PAGE_LOADING });

/* Settings actions */
export const setDomain = payload => ({ type: types.SET_DOMAIN, payload });
export const setApiKey = payload => ({ type: types.SET_APIKEY, payload });
const deleteDomain = () => ({ type: types.DELETE_DOMAIN });
const setDomainError = payload => ({ type: types.DOMAIN_ERROR, payload });
const showDomainLoading = () => ({ type: types.DOMAIN_LOADING });
const showApiLoading = () => ({ type: types.API_LOADING });
export const showDomainInput = () => ({ type: types.SHOW_DOMAIN_INPUT });

export const getUserSettings = () => dispatch =>
  axios
    .post('/api/auth/usersettings', null, { headers: { Authorization: cookie.get('token') } })
    .then(({ data }) => {
      dispatch(setDomain(data.customDomain));
      dispatch(setApiKey(data.apikey));
    });

export const setCustomDomain = params => dispatch => {
  dispatch(showDomainLoading());
  return axios
    .post('/api/url/customdomain', params, { headers: { Authorization: cookie.get('token') } })
    .then(({ data }) => dispatch(setDomain(data.customDomain)))
    .catch(({ response }) => dispatch(setDomainError(response.data.error)));
};

export const deleteCustomDomain = () => dispatch =>
  axios
    .delete('/api/url/customdomain', { headers: { Authorization: cookie.get('token') } })
    .then(() => dispatch(deleteDomain()))
    .catch(({ response }) => dispatch(setDomainError(response.data.error)));

export const generateApiKey = () => dispatch => {
  dispatch(showApiLoading());
  return axios
    .post('/api/auth/generateapikey', null, { headers: { Authorization: cookie.get('token') } })
    .then(({ data }) => dispatch(setApiKey(data.apikey)));
};

/* Login & signup actions */
export const authUser = payload => ({ type: types.AUTH_USER, payload: decodeJwt(payload).sub });
export const unauthUser = () => ({ type: types.UNAUTH_USER });
export const sentVerification = payload => ({ type: types.SENT_VERIFICATION, payload });
export const showAuthError = payload => ({ type: types.AUTH_ERROR, payload });
export const showLoginLoading = () => ({ type: types.LOGIN_LOADING });
export const showSignupLoading = () => ({ type: types.SIGNUP_LOADING });
export const authRenew = () => ({ type: types.AUTH_RENEW });

export const signupUser = body => dispatch => {
  dispatch(showSignupLoading());
  return axios
    .post('/api/auth/signup', body)
    .then(res => {
      const { email } = res.data;
      dispatch(sentVerification(email));
    })
    .catch(err => dispatch(showAuthError(err.response.data.error)));
};

export const loginUser = body => dispatch => {
  dispatch(showLoginLoading());
  return axios
    .post('/api/auth/login', body)
    .then(res => {
      const { token } = res.data;
      cookie.set('token', token, { expires: 7 });
      dispatch(authRenew());
      dispatch(authUser(token));
      dispatch(showPageLoading());
      Router.push('/');
    })
    .catch(err => dispatch(showAuthError(err.response.data.error)));
};

export const logoutUser = () => dispatch => {
  dispatch(showPageLoading());
  cookie.remove('token');
  dispatch(unauthUser());
  return Router.push('/login');
};

export const renewAuthUser = () => (dispatch, getState) => {
  if (getState().auth.renew) return null;
  return axios
    .post('/api/auth/renew', null, { headers: { Authorization: cookie.get('token') } })
    .then(res => {
      const { token } = res.data;
      cookie.set('token', token, { expires: 7 });
      dispatch(authRenew());
      dispatch(authUser(token));
    })
    .catch(() => {
      cookie.remove('token');
      dispatch(unauthUser());
    });
};
