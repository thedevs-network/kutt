import { expect } from 'chai';
import deepFreeze from 'deep-freeze';

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
  SET_APIKEY
} from '../../actions/actionTypes';

import reducer from '../loading';

describe('loading reducer', () => {
  const initialState = {
    api: false,
    domain: false,
    shortener: false,
    login: false,
    page: false,
    table: false,
    signup: false
  };

  beforeEach(() => {
    deepFreeze(initialState);
  });

  it('should return the initial state', () => {
    expect(reducer(undefined, {})).to.deep.equal(initialState);
  });

  it('should handle SHOW_PAGE_LOADING', () => {
    const state = reducer(initialState, {
      type: SHOW_PAGE_LOADING
    });

    expect(state).not.to.be.undefined;
    expect(state.page).to.be.true;
  });

  it('should handle HIDE_PAGE_LOADING', () => {
    const state = reducer(initialState, {
      type: HIDE_PAGE_LOADING
    });

    expect(state).not.to.be.undefined;
    expect(state.shortener).to.be.false;
    expect(state.login).to.be.false;
    expect(state.page).to.be.false;
    expect(state.signup).to.be.false;
  });

  it('should handle TABLE_LOADING', () => {
    const state = reducer(initialState, {
      type: TABLE_LOADING
    });

    expect(state).not.to.be.undefined;
    expect(state.table).to.be.true;
  });

  it('should handle LOGIN_LOADING', () => {
    const state = reducer(initialState, {
      type: LOGIN_LOADING
    });

    expect(state).not.to.be.undefined;
    expect(state.login).to.be.true;
  });

  it('should handle SIGNUP_LOADING', () => {
    const state = reducer(initialState, {
      type: SIGNUP_LOADING
    });

    expect(state).not.to.be.undefined;
    expect(state.signup).to.be.true;
  });

  it('should handle SHORTENER_LOADING', () => {
    const state = reducer(initialState, {
      type: SHORTENER_LOADING
    });

    expect(state).not.to.be.undefined;
    expect(state.shortener).to.be.true;
  });

  it('should handle ADD_URL', () => {
    const state = reducer(initialState, {
      type: ADD_URL
    });

    expect(state).not.to.be.undefined;
    expect(state.shortener).to.be.false;
  });

  it('should handle SHORTENER_ERROR', () => {
    const state = reducer(initialState, {
      type: SHORTENER_ERROR
    });

    expect(state).not.to.be.undefined;
    expect(state.shortener).to.be.false;
  });

  it('should handle LIST_URLS', () => {
    const state = reducer(initialState, {
      type: LIST_URLS
    });

    expect(state).not.to.be.undefined;
    expect(state.table).to.be.false;
  });

  it('should handle DELETE_URL', () => {
    const state = reducer(initialState, {
      type: DELETE_URL
    });

    expect(state).not.to.be.undefined;
    expect(state.table).to.be.false;
  });

  it('should handle AUTH_ERROR', () => {
    const state = reducer(initialState, {
      type: AUTH_ERROR
    });

    expect(state).not.to.be.undefined;
    expect(state.login).to.be.false;
    expect(state.signup).to.be.false;
  });

  it('should handle AUTH_USER', () => {
    const state = reducer(initialState, {
      type: AUTH_USER
    });

    expect(state).not.to.be.undefined;
    expect(state.login).to.be.false;
    expect(state.signup).to.be.false;
  });

  it('should handle DOMAIN_LOADING', () => {
    const state = reducer(initialState, {
      type: DOMAIN_LOADING
    });

    expect(state).not.to.be.undefined;
    expect(state.domain).to.be.true;
  });

  it('should handle SET_DOMAIN', () => {
    const state = reducer(initialState, {
      type: SET_DOMAIN
    });

    expect(state).not.to.be.undefined;
    expect(state.domain).to.be.false;
  });

  it('should handle DOMAIN_ERROR', () => {
    const state = reducer(initialState, {
      type: DOMAIN_ERROR
    });

    expect(state).not.to.be.undefined;
    expect(state.domain).to.be.false;
  });

  it('should handle API_LOADING', () => {
    const state = reducer(initialState, {
      type: API_LOADING
    });

    expect(state).not.to.be.undefined;
    expect(state.api).to.be.true;
  });

  it('should handle SET_APIKEY', () => {
    const state = reducer(initialState, {
      type: SET_APIKEY
    });

    expect(state).not.to.be.undefined;
    expect(state.api).to.be.false;
  });

  it('should not handle other action types', () => {
    const state = reducer(initialState, {
      type: 'ANOTHER_ACTION'
    });

    expect(state).not.to.be.undefined;
    expect(state).to.deep.equal(initialState);
  });
});
