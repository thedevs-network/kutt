import ReactGA from 'react-ga';
import { GOOGLE_ANALYTICS_ID } from '../config';

export const initGA = () => {
  ReactGA.initialize(GOOGLE_ANALYTICS_ID, { debug: true });
};

export const logPageView = () => {
  ReactGA.set({ page: window.location.pathname });
  ReactGA.pageview(window.location.pathname);
};

export const logEvent = (category = '', action = '') => {
  if (category && action) {
    ReactGA.event({ category, action });
  }
};

export const logException = (description = '', fatal = false) => {
  if (description) {
    ReactGA.exception({ description, fatal });
  }
};
