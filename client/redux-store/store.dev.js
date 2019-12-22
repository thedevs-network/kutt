import { createStore, applyMiddleware } from 'redux';
import { composeWithDevTools } from 'redux-devtools-extension';
import thunk from 'redux-thunk';
import rootReducer from '../reducers';

const store = initialState =>
  createStore(rootReducer, initialState, composeWithDevTools(applyMiddleware(thunk)));

export default store;
