import nock from 'nock';
import sinon from 'sinon';
import { expect } from 'chai';
import cookie from 'js-cookie';
import thunk from 'redux-thunk';
import configureMockStore from 'redux-mock-store';

import { createShortUrl, getUrlsList, deleteShortUrl } from '../url';
import { ADD_URL, LIST_URLS, DELETE_URL, TABLE_LOADING } from '../actionTypes';

const middlewares = [thunk];
const mockStore = configureMockStore(middlewares);

describe('url actions', () => {
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

  describe('#createShortUrl()', () => {
    it('should dispatch ADD_URL when creating short url has been done', done => {
      const url = 'test.com';
      const mockedItems = {
        createdAt: '2018-06-16T15:40:35.243Z',
        id: '123',
        target: url,
        password: false,
        reuse: false,
        shortUrl: 'http://kutt.it/123'
      };

      nock('http://localhost', {
        reqheaders: {
          Authorization: token
        }
      })
        .post('/api/url/submit')
        .reply(200, mockedItems);

      const store = mockStore({});

      const expectedActions = [
        {
          type: ADD_URL,
          payload: mockedItems
        }
      ];

      store
        .dispatch(createShortUrl(url))
        .then(() => {
          expect(store.getActions()).to.deep.equal(expectedActions);
          done();
        })
        .catch(error => done(error));
    });
  });

  describe('#getUrlsList()', () => {
    it('should dispatch LIST_URLS when getting urls list has been done', done => {
      const mockedQueryParams = {
        isShortened: false,
        count: 10,
        countAll: 1,
        page: 1,
        search: ''
      };

      const mockedItems = {
        list: [
          {
            createdAt: '2018-06-16T16:45:28.607Z',
            id: 'UkEs33',
            target: 'https://kutt.it/',
            password: false,
            count: 0,
            shortUrl: 'http://test.com/UkEs33'
          }
        ],
        countAll: 1
      };

      nock('http://localhost', {
        reqheaders: {
          Authorization: token
        }
      })
        .get('/api/url/geturls')
        .query(mockedQueryParams)
        .reply(200, mockedItems);

      const store = mockStore({ url: { list: [], ...mockedQueryParams } });

      const expectedActions = [
        { type: TABLE_LOADING },
        {
          type: LIST_URLS,
          payload: mockedItems
        }
      ];

      store
        .dispatch(getUrlsList())
        .then(() => {
          expect(store.getActions()).to.deep.equal(expectedActions);
          done();
        })
        .catch(error => done(error));
    });
  });

  describe('#deleteShortUrl()', () => {
    it('should dispatch DELETE_URL when deleting short url has been done', done => {
      const id = '123';
      const mockedItems = [
        {
          createdAt: '2018-06-16T15:40:35.243Z',
          id: '123',
          target: 'test.com',
          password: false,
          reuse: false,
          shortUrl: 'http://kutt.it/123'
        }
      ];

      nock('http://localhost', {
        reqheaders: {
          Authorization: token
        }
      })
        .post('/api/url/deleteurl')
        .reply(200, { message: 'Short URL deleted successfully' });

      const store = mockStore({ url: { list: mockedItems } });

      const expectedActions = [
        { type: TABLE_LOADING },
        { type: DELETE_URL, payload: id }
      ];

      store
        .dispatch(deleteShortUrl({ id }))
        .then(() => {
          expect(store.getActions()).to.deep.equal(expectedActions);
          done();
        })
        .catch(error => done(error));
    });
  });
});
