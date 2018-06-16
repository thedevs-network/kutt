import {
  ADD_URL,
  UPDATE_URL_LIST,
  LIST_URLS,
  DELETE_URL,
  UNAUTH_USER,
} from '../actions/actionTypes';

const initialState = {
  list: [],
  isShortened: false,
  count: 10,
  countAll: 0,
  page: 1,
  search: '',
};

const url = (state = initialState, action) => {
  const { count, page, search } = action.payload || {};
  const isSearch = typeof search !== 'undefined';
  switch (action.type) {
    case ADD_URL:
      return {
        ...state,
        isShortened: true,
        list: [action.payload, ...state.list],
      };
    case UPDATE_URL_LIST:
      return Object.assign({}, state, count && { count }, page && { page }, isSearch && { search });
    case LIST_URLS:
      return {
        ...state,
        list: action.payload.list,
        countAll: action.payload.countAll,
        isShortened: false,
      };
    case DELETE_URL:
      return {
        ...state,
        list: state.list.filter(item => item.id !== action.payload),
      };
    case UNAUTH_USER:
      return initialState;
    default:
      return state;
  }
};

export default url;
