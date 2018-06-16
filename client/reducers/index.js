import { combineReducers } from 'redux';

import url from './url';
import auth from './auth';
import error from './error';
import loading from './loading';
import settings from './settings';

const rootReducer = combineReducers({
  url,
  auth,
  error,
  loading,
  settings,
});

export default rootReducer;
