import { createStore, applyMiddleware } from 'redux';
import thunk from 'redux-thunk';
import rootReducer from '../reducers';

const store = initialState => createStore(rootReducer, initialState, applyMiddleware(thunk));

export default store;
