import { expect } from 'chai';
import deepFreeze from 'deep-freeze';

import {
  SET_DOMAIN,
  SET_APIKEY,
  DELETE_DOMAIN,
  SHOW_DOMAIN_INPUT,
  UNAUTH_USER
} from '../../actions/actionTypes';

import reducer from '../settings';

describe('settings reducer', () => {
  const initialState = {
    apikey: '',
    customDomain: '',
    homepage: '',
    domainInput: true,
  };

  beforeEach(() => {
    deepFreeze(initialState);
  });

  it('should return the initial state', () => {
    expect(reducer(undefined, {})).to.deep.equal(initialState);
  });

  it('should handle SET_DOMAIN', () => {
    const customDomain = 'example.com';
    const homepage = '';

    const state = reducer(initialState, {
      type: SET_DOMAIN,
      payload: { customDomain, homepage }
    });

    expect(state).not.to.be.undefined;
    expect(state.customDomain).to.be.equal(customDomain);
    expect(state.domainInput).to.be.false;
  });

  it('should handle SET_APIKEY', () => {
    const apikey = '1234567';

    const state = reducer(initialState, {
      type: SET_APIKEY,
      payload: apikey
    });

    expect(state).not.to.be.undefined;
    expect(state.apikey).to.be.equal(apikey);
  });

  it('should handle DELETE_DOMAIN', () => {
    const state = reducer(initialState, {
      type: DELETE_DOMAIN
    });

    expect(state).not.to.be.undefined;
    expect(state.customDomain).to.be.empty;
    expect(state.domainInput).to.be.true;
  });

  it('should handle SHOW_DOMAIN_INPUT', () => {
    const state = reducer(initialState, {
      type: SHOW_DOMAIN_INPUT
    });

    expect(state).not.to.be.undefined;
    expect(state.domainInput).to.be.true;
  });

  it('should handle UNAUTH_USER', () => {
    const state = reducer(initialState, {
      type: UNAUTH_USER
    });

    expect(state).not.to.be.undefined;
    expect(state).to.deep.equal(initialState);
  });

  it('should not handle other action types', () => {
    const state = reducer(initialState, {
      type: 'ANOTHER_ACTION'
    });

    expect(state).not.to.be.undefined;
    expect(state).to.deep.equal(initialState);
  });
});
