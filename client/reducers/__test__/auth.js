import { expect } from 'chai';
import deepFreeze from 'deep-freeze';

import {
  AUTH_USER,
  AUTH_RENEW,
  UNAUTH_USER,
  SENT_VERIFICATION
} from '../../actions/actionTypes';

import reducer from '../auth';

describe('auth reducer', () => {
  const initialState = {
    admin: false,
    isAuthenticated: false,
    sentVerification: false,
    user: '',
    renew: false,
  };

  beforeEach(() => {
    deepFreeze(initialState);
  });

  it('should return the initial state', () => {
    expect(reducer(undefined, {})).to.deep.equal(initialState);
  });

  it('should handle AUTH_USER', () => {
    const jwt = {
      domain: '',
      exp: 1529137738725,
      iat: 1529137738725,
      iss: 'ApiAuth',
      sub: 'test@user.com',
    };

    const user = 'test@user.com';

    const state = reducer(initialState, {
      type: AUTH_USER,
      payload: jwt
    });

    expect(state).not.to.be.undefined;
    expect(state.isAuthenticated).to.be.true;
    expect(state.user).to.be.equal(user);
    expect(state.sentVerification).to.be.false;
  });

  it('should handle AUTH_RENEW', () => {
    const state = reducer(initialState, {
      type: AUTH_RENEW
    });

    expect(state).not.to.be.undefined;
    expect(state.renew).to.be.true;
  });

  it('should handle UNAUTH_USER', () => {
    const state = reducer(initialState, {
      type: UNAUTH_USER
    });

    expect(state).not.to.be.undefined;
    expect(state).to.deep.equal(initialState);
  });

  it('should handle SENT_VERIFICATION', () => {
    const user = 'test@user.com';

    const state = reducer(initialState, {
      type: SENT_VERIFICATION,
      payload: user
    });

    expect(state).not.to.be.undefined;
    expect(state.sentVerification).to.be.true;
    expect(state.user).to.be.equal(user);
  });

  it('should not handle other action types', () => {
    const state = reducer(initialState, {
      type: 'ANOTHER_ACTION'
    });

    expect(state).not.to.be.undefined;
    expect(state).to.deep.equal(initialState);
  });
});
