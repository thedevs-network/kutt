import axios from 'axios';
import cookie from 'js-cookie';
import {
  DELETE_DOMAIN,
  DOMAIN_ERROR,
  DOMAIN_LOADING,
  API_LOADING,
  SET_DOMAIN,
  SET_APIKEY,
  SHOW_DOMAIN_INPUT,
  BAN_URL,
} from './actionTypes';

const deleteDomain = () => ({ type: DELETE_DOMAIN });
const setDomainError = payload => ({ type: DOMAIN_ERROR, payload });
const showDomainLoading = () => ({ type: DOMAIN_LOADING });
const showApiLoading = () => ({ type: API_LOADING });
const urlBanned = () => ({ type: BAN_URL });

export const setDomain = payload => ({ type: SET_DOMAIN, payload });
export const setApiKey = payload => ({ type: SET_APIKEY, payload });
export const showDomainInput = () => ({ type: SHOW_DOMAIN_INPUT });

export const getUserSettings = () => async dispatch => {
  try {
    const { data } = await axios.get('/api/auth/usersettings', {
      headers: { Authorization: cookie.get('token') },
    });
    dispatch(setDomain(data.customDomain));
    dispatch(setApiKey(data.apikey));
  } catch (error) {
    //
  }
};

export const setCustomDomain = params => async dispatch => {
  dispatch(showDomainLoading());
  try {
    const { data } = await axios.post('/api/url/customdomain', params, {
      headers: { Authorization: cookie.get('token') },
    });
    dispatch(setDomain(data.customDomain));
  } catch ({ response }) {
    dispatch(setDomainError(response.data.error));
  }
};

export const deleteCustomDomain = () => async dispatch => {
  try {
    await axios.delete('/api/url/customdomain', {
      headers: { Authorization: cookie.get('token') },
    });
    dispatch(deleteDomain());
  } catch ({ response }) {
    dispatch(setDomainError(response.data.error));
  }
};

export const generateApiKey = () => async dispatch => {
  dispatch(showApiLoading());
  try {
    const { data } = await axios.post('/api/auth/generateapikey', null, {
      headers: { Authorization: cookie.get('token') },
    });
    dispatch(setApiKey(data.apikey));
  } catch (error) {
    //
  }
};

export const banUrl = params => async dispatch => {
  try {
    const { data } = await axios.post('/api/url/admin/ban', params, {
      headers: { Authorization: cookie.get('token') },
    });
    dispatch(urlBanned());
    return data.message;
  } catch ({ response }) {
    return Promise.reject(response.data && response.data.error);
  }
};
