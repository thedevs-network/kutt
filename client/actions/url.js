import axios from 'axios';
import cookie from 'js-cookie';
import {
  ADD_URL,
  LIST_URLS,
  UPDATE_URL_LIST,
  DELETE_URL,
  SHORTENER_LOADING,
  TABLE_LOADING,
  SHORTENER_ERROR,
} from './actionTypes';

const addUrl = payload => ({ type: ADD_URL, payload });
const listUrls = payload => ({ type: LIST_URLS, payload });
const updateUrlList = payload => ({ type: UPDATE_URL_LIST, payload });
const deleteUrl = payload => ({ type: DELETE_URL, payload });
const showTableLoading = () => ({ type: TABLE_LOADING });

export const setShortenerFormError = payload => ({
  type: SHORTENER_ERROR,
  payload,
});

export const showShortenerLoading = () => ({ type: SHORTENER_LOADING });

export const createShortUrl = params => async dispatch => {
  try {
    const { data } = await axios.post('/api/url/submit', params, {
      headers: { Authorization: cookie.get('token') },
    });
    dispatch(addUrl(data));
  } catch ({ response }) {
    dispatch(setShortenerFormError(response.data.error));
  }
};

export const getUrlsList = params => async (dispatch, getState) => {
  if (params) {
    dispatch(updateUrlList(params));
  }

  dispatch(showTableLoading());

  const { url } = getState();
  const { list, ...queryParams } = url;
  const query = Object.keys(queryParams).reduce(
    (string, item) => `${string + item}=${queryParams[item]}&`,
    '?'
  );

  try {
    const { data } = await axios.get(`/api/url/geturls${query}`, {
      headers: { Authorization: cookie.get('token') },
    });
    dispatch(listUrls(data));
  } catch (error) {
    //
  }
};

export const deleteShortUrl = params => async dispatch => {
  dispatch(showTableLoading());
  try {
    await axios.post('/api/url/deleteurl', params, {
      headers: { Authorization: cookie.get('token') },
    });
    dispatch(deleteUrl(params.id));
  } catch ({ response }) {
    dispatch(setShortenerFormError(response.data.error));
  }
};
