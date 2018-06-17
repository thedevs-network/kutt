import { expect } from 'chai';
import deepFreeze from 'deep-freeze';

import {
  SHORTENER_ERROR,
  DOMAIN_ERROR,
  SET_DOMAIN,
  SHOW_DOMAIN_INPUT,
  ADD_URL,
  UPDATE_URL,
  AUTH_ERROR,
  AUTH_USER,
  HIDE_PAGE_LOADING
} from '../../actions/actionTypes';

import reducer from '../error';

describe('error reducer', () => {
  const initialState = {
    auth: '',
    domain: '',
    shortener: '',
    urlOptions: ''
  };

  beforeEach(() => {
    deepFreeze(initialState);
  });

  it('should return the initial state', () => {
    expect(reducer(undefined, {})).to.deep.equal(initialState);
  });

  it('should handle SHORTENER_ERROR', () => {
    const error = 'SHORTENER_ERROR';

    const state = reducer(initialState, {
      type: SHORTENER_ERROR,
      payload: error
    });

    expect(state).not.to.be.undefined;
    expect(state.shortener).to.be.equal(error);
  });

  it('should handle DOMAIN_ERROR', () => {
    const error = 'DOMAIN_ERROR';

    const state = reducer(initialState, {
      type: DOMAIN_ERROR,
      payload: error
    });

    expect(state).not.to.be.undefined;
    expect(state.domain).to.be.equal(error);
  });

  it('should handle SET_DOMAIN', () => {
    const state = reducer(initialState, {
      type: SET_DOMAIN
    });

    expect(state).not.to.be.undefined;
    expect(state.domain).to.be.empty;
  });

  it('should handle SHOW_DOMAIN_INPUT', () => {
    const state = reducer(initialState, {
      type: SHOW_DOMAIN_INPUT
    });

    expect(state).not.to.be.undefined;
    expect(state.domain).to.be.empty;
  });

  it('should handle ADD_URL', () => {
    const state = reducer(initialState, {
      type: ADD_URL
    });

    expect(state).not.to.be.undefined;
    expect(state.shortener).to.be.empty;
  });

  it('should handle UPDATE_URL', () => {
    const state = reducer(initialState, {
      type: UPDATE_URL
    });

    expect(state).not.to.be.undefined;
    expect(state.urlOptions).to.be.empty;
  });

  it('should handle AUTH_ERROR', () => {
    const error = 'AUTH_ERROR';

    const state = reducer(initialState, {
      type: AUTH_ERROR,
      payload: error
    });

    expect(state).not.to.be.undefined;
    expect(state.auth).to.be.equal(error);
  });

  it('should handle AUTH_USER', () => {
    const state = reducer(initialState, {
      type: AUTH_USER
    });

    expect(state).not.to.be.undefined;
    expect(state.auth).to.be.empty;
  });

  it('should handle HIDE_PAGE_LOADING', () => {
    const state = reducer(initialState, {
      type: HIDE_PAGE_LOADING
    });

    expect(state).not.to.be.undefined;
    expect(state.auth).to.be.empty;
    expect(state.shortener).to.be.empty;
    expect(state.urlOptions).to.be.empty;
  });

  it('should not handle other action types', () => {
    const state = reducer(initialState, {
      type: 'ANOTHER_ACTION'
    });

    expect(state).not.to.be.undefined;
    expect(state).to.deep.equal(initialState);
  });
});
