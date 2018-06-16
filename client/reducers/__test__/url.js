import { expect } from 'chai';
import deepFreeze from 'deep-freeze';

import {
  ADD_URL,
  UPDATE_URL_LIST,
  LIST_URLS,
  DELETE_URL,
  UNAUTH_USER
} from '../../actions/actionTypes';

import reducer from '../url';

describe('url reducer', () => {
  const initialState = {
    list: [],
    isShortened: false,
    count: 10,
    countAll: 0,
    page: 1,
    search: ''
  };

  beforeEach(() => {
    deepFreeze(initialState);
  });

  it('should return the initial state', () => {
    expect(reducer(undefined, {})).to.deep.equal(initialState);
  });

  it('should handle ADD_URL', () => {
    const item = {
      createdAt: '2018-06-12T19:23:00.272Z',
      id: 'YufjdS',
      target: 'https://kutt.it/',
      password: false,
      reuse: false,
      shortUrl: 'https://kutt.it/YufjdS'
    };

    const state = reducer(initialState, {
      type: ADD_URL,
      payload: item
    });

    expect(state.list).to.be.an('array');
    expect(state.list).to.have.lengthOf(1);
    expect(state.list).to.include(item);
    expect(state.isShortened).to.be.true;
  });

  it('should handle UPDATE_URL_LIST', () => {
    const count = 10;
    const page = 1;
    const search = 'test url';

    const allParamsState = reducer(initialState, {
      type: UPDATE_URL_LIST,
      payload: { count, page, search }
    });

    expect(allParamsState).not.to.be.undefined;
    expect(allParamsState.count).to.be.equal(count);
    expect(allParamsState.page).to.be.equal(page);
    expect(allParamsState.search).to.be.equal(search);

    const countState = reducer(initialState, {
      type: UPDATE_URL_LIST,
      payload: { count }
    });

    expect(countState).not.to.be.undefined;
    expect(countState.count).to.be.equal(count);

    const pageState = reducer(initialState, {
      type: UPDATE_URL_LIST,
      payload: { page }
    });

    expect(pageState).not.to.be.undefined;
    expect(pageState.page).to.be.equal(page);

    const searchState = reducer(initialState, {
      type: UPDATE_URL_LIST,
      payload: { search }
    });

    expect(searchState).not.to.be.undefined;
    expect(searchState.search).to.be.equal(search);

    const state = reducer(initialState, {
      type: UPDATE_URL_LIST
    });

    expect(state).not.to.be.undefined;
    expect(state).to.deep.equal(initialState);
  });

  it('should handle LIST_URLS', () => {
    const list = [
      {
        createdAt: '2018-06-12T19:23:00.272Z',
        id: 'YufjdS',
        target: 'https://kutt.it/',
        password: false,
        reuse: false,
        shortUrl: 'https://kutt.it/YufjdS'
      },
      {
        createdAt: '2018-06-12T19:51:56.435Z',
        id: '1gCdbC',
        target: 'https://kutt.it/',
        password: false,
        reuse: false,
        shortUrl: 'https://kutt.it/1gCdbC'
      }
    ];

    const countAll = list.length;

    const state = reducer(initialState, {
      type: LIST_URLS,
      payload: { list, countAll }
    });

    expect(state.list).to.be.an('array');
    expect(state.list).to.have.lengthOf(2);
    expect(state.list).to.not.include(list);
    expect(state.countAll).to.be.equal(countAll);
    expect(state.isShortened).to.be.false;
  });

  it('should handle DELETE_URL', () => {
    const itemsState = {
      list: [
        {
          createdAt: '2018-06-12T19:23:00.272Z',
          id: 'YufjdS',
          target: 'https://kutt.it/',
          password: false,
          reuse: false,
          shortUrl: 'https://kutt.it/YufjdS'
        },
        {
          createdAt: '2018-06-12T19:51:56.435Z',
          id: '1gCdbC',
          target: 'https://kutt.it/',
          password: false,
          reuse: false,
          shortUrl: 'https://kutt.it/1gCdbC'
        }
      ],
      isShortened: true,
      count: 10,
      countAll: 2,
      page: 1,
      search: ''
    };

    deepFreeze(itemsState);

    const state = reducer(itemsState, {
      type: DELETE_URL,
      payload: 'YufjdS'
    });

    expect(state.list).to.be.an('array');
    expect(state.list).to.have.lengthOf(1);
    expect(state.list).to.not.include({
      createdAt: '2018-06-12T19:23:00.272Z',
      id: 'YufjdS',
      target: 'https://kutt.it/',
      password: false,
      reuse: false,
      shortUrl: 'https://kutt.it/YufjdS'
    });
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
