import nock from 'nock';
import sinon from 'sinon';
import { expect } from 'chai';
import cookie from 'js-cookie';
import thunk from 'redux-thunk';
import configureMockStore from 'redux-mock-store';

import {
  getUserSettings,
  setCustomDomain,
  deleteCustomDomain,
  generateApiKey
} from '../settings';
import {
  DELETE_DOMAIN,
  DOMAIN_LOADING,
  API_LOADING,
  SET_DOMAIN,
  SET_APIKEY
} from '../actionTypes';

const middlewares = [thunk];
const mockStore = configureMockStore(middlewares);

describe('settings actions', () => {
  const token =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJBcGlBdXRoIiwic3ViIjoidGVzdEBtYWlsLmNvbSIsImRvbWFpbiI6IiIsImlhdCI6MTUyOTEzNzczODcyNSwiZXhwIjoxNTI5MTM3NzM4NzI1fQ.tdI7r11bmSCUmbcJBBKIDt7Hkb7POLMRl8VNJv_8O_s';

  let cookieStub;

  beforeEach(() => {
    cookieStub = sinon.stub(cookie, 'get');
    cookieStub.withArgs('token').returns(token);
  });

  afterEach(() => {
    cookieStub.restore();
  });

  describe('#getUserSettings()', () => {
    it('should dispatch SET_APIKEY and SET_DOMAIN when getting user settings have been done', done => {
      const apikey = '123';
      const customDomain = 'test.com';
      const homepage = '';
      const useHttps = false;

      nock('http://localhost', {
        reqheaders: {
          Authorization: token
        }
      })
        .get('/api/auth/usersettings')
        .reply(200, { apikey, customDomain, homepage, useHttps });

      const store = mockStore({});

      const expectedActions = [
        {
          type: SET_DOMAIN,
          payload: {
            customDomain,
            homepage: '',
            useHttps: false,
          }
        },
        {
          type: SET_APIKEY,
          payload: apikey
        }
      ];

      store
        .dispatch(getUserSettings())
        .then(() => {
          expect(store.getActions()).to.deep.equal(expectedActions);
          done();
        })
        .catch(error => done(error));
    });
  });

  describe('#setCustomDomain()', () => {
    it('should dispatch SET_DOMAIN when setting custom domain has been done', done => {
      const customDomain = 'test.com';
      const homepage = '';
      const useHttps = false;

      nock('http://localhost', {
        reqheaders: {
          Authorization: token
        }
      })
        .post('/api/url/customdomain')
        .reply(200, { customDomain, homepage, useHttps });

      const store = mockStore({});

      const expectedActions = [
        { type: DOMAIN_LOADING },
        {
          type: SET_DOMAIN,
          payload: {
            customDomain,
            homepage: '',
            useHttps: false,
          }
        }
      ];

      store
        .dispatch(setCustomDomain({
          customDomain,
          homepage: '',
          useHttps: false,
        }))
        .then(() => {
          expect(store.getActions()).to.deep.equal(expectedActions);
          done();
        })
        .catch(error => done(error));
    });
  });

  describe('#deleteCustomDomain()', () => {
    it('should dispatch DELETE_DOMAIN when deleting custom domain has been done', done => {
      const customDomain = 'test.com';

      nock('http://localhost', {
        reqheaders: {
          Authorization: token
        }
      })
        .delete('/api/url/customdomain')
        .reply(200, { customDomain });

      const store = mockStore({});

      const expectedActions = [{ type: DELETE_DOMAIN }];

      store
        .dispatch(deleteCustomDomain(customDomain))
        .then(() => {
          expect(store.getActions()).to.deep.equal(expectedActions);
          done();
        })
        .catch(error => done(error));
    });
  });

  describe('#generateApiKey()', () => {
    it('should dispatch SET_APIKEY when generating api key has been done', done => {
      const apikey = '123';

      nock('http://localhost', {
        reqheaders: {
          Authorization: token
        }
      })
        .post('/api/auth/generateapikey')
        .reply(200, { apikey });

      const store = mockStore({});

      const expectedActions = [
        { type: API_LOADING },
        {
          type: SET_APIKEY,
          payload: apikey
        }
      ];

      store
        .dispatch(generateApiKey())
        .then(() => {
          expect(store.getActions()).to.deep.equal(expectedActions);
          done();
        })
        .catch(error => done(error));
    });
  });
});
