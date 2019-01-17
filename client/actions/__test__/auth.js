import nock from 'nock';
import sinon from 'sinon';
import { expect } from 'chai';
import cookie from 'js-cookie';
import thunk from 'redux-thunk';
import Router from 'next/router';
import configureMockStore from 'redux-mock-store';

import { signupUser, loginUser, logoutUser, renewAuthUser } from '../auth';
import {
  SIGNUP_LOADING,
  SENT_VERIFICATION,
  LOGIN_LOADING,
  AUTH_RENEW,
  AUTH_USER,
  SET_DOMAIN,
  SHOW_PAGE_LOADING,
  UNAUTH_USER
} from '../actionTypes';

const middlewares = [thunk];
const mockStore = configureMockStore(middlewares);

describe('auth actions', () => {
  const jwt = {
    domain: '',
    exp: 1529137738725,
    iat: 1529137738725,
    iss: 'ApiAuth',
    sub: 'test@mail.com',
  };
  const email = 'test@mail.com';
  const password = 'password';
  const token =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJBcGlBdXRoIiwic3ViIjoidGVzdEBtYWlsLmNvbSIsImRvbWFpbiI6IiIsImlhdCI6MTUyOTEzNzczODcyNSwiZXhwIjoxNTI5MTM3NzM4NzI1fQ.tdI7r11bmSCUmbcJBBKIDt7Hkb7POLMRl8VNJv_8O_s';

  describe('#signupUser()', () => {
    it('should dispatch SENT_VERIFICATION when signing up user has been done', done => {
      nock('http://localhost')
        .post('/api/auth/signup')
        .reply(200, {
          email,
          message: 'Verification email has been sent.'
        });

      const store = mockStore({});

      const expectedActions = [
        { type: SIGNUP_LOADING },
        {
          type: SENT_VERIFICATION,
          payload: email
        }
      ];

      store
        .dispatch(signupUser(email, password))
        .then(() => {
          expect(store.getActions()).to.deep.equal(expectedActions);
          done();
        })
        .catch(error => done(error));
    });
  });

  describe('#loginUser()', () => {
    it('should dispatch AUTH_USER when logining user has been done', done => {
      const pushStub = sinon.stub(Router, 'push');
      pushStub.withArgs('/').returns('/');
      const expectedRoute = '/';

      nock('http://localhost')
        .post('/api/auth/login')
        .reply(200, {
          token
        });

      const store = mockStore({});

      const expectedActions = [
        { type: LOGIN_LOADING },
        { type: AUTH_RENEW },
        {
          type: AUTH_USER,
          payload: jwt
        },
        {
          type: SET_DOMAIN,
          payload: ''
        },
        { type: SHOW_PAGE_LOADING }
      ];

      store
        .dispatch(loginUser(email, password))
        .then(() => {
          expect(store.getActions()).to.deep.equal(expectedActions);

          pushStub.restore();
          sinon.assert.calledWith(pushStub, expectedRoute);

          done();
        })
        .catch(error => done(error));
    });
  });

  describe('#logoutUser()', () => {
    it('should dispatch UNAUTH_USER when loging out user has been done', () => {
      const pushStub = sinon.stub(Router, 'push');
      pushStub.withArgs('/login').returns('/login');
      const expectedRoute = '/login';

      const store = mockStore({});

      const expectedActions = [
        { type: SHOW_PAGE_LOADING },
        { type: UNAUTH_USER }
      ];

      store.dispatch(logoutUser());
      expect(store.getActions()).to.deep.equal(expectedActions);

      pushStub.restore();
      sinon.assert.calledWith(pushStub, expectedRoute);
    });
  });

  describe('#renewAuthUser()', () => {
    it('should dispatch AUTH_RENEW when renewing auth user has been done', done => {
      const cookieStub = sinon.stub(cookie, 'get');
      cookieStub.withArgs('token').returns(token);

      nock('http://localhost', {
        reqheaders: {
          Authorization: token
        }
      })
        .post('/api/auth/renew')
        .reply(200, {
          token
        });

      const store = mockStore({ auth: { renew: false } });

      const expectedActions = [
        { type: AUTH_RENEW },
        {
          type: AUTH_USER,
          payload: jwt
        },
        {
          type: SET_DOMAIN,
          payload: ''
        }
      ];

      store
        .dispatch(renewAuthUser())
        .then(() => {
          expect(store.getActions()).to.deep.equal(expectedActions);
          cookieStub.restore();
          done();
        })
        .catch(error => done(error));
    });
  });
});
