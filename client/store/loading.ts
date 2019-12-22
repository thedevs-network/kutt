import { action, Action } from "easy-peasy";

export interface Loading {
  loading: boolean;
  show: Action<Loading>;
  hide: Action<Loading>;
}

export const loading: Loading = {
  loading: false,
  show: action(state => {
    state.loading = true;
  }),
  hide: action(state => {
    state.loading = false;
  })
};
