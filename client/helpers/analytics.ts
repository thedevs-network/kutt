import getConfig from "next/config";
import ReactGA from "react-ga";

const { publicRuntimeConfig } = getConfig();

export const initGA = () => {
  ReactGA.initialize(publicRuntimeConfig.GOOGLE_ANALYTICS);
};

export const logPageView = () => {
  ReactGA.set({ page: window.location.pathname });
  ReactGA.pageview(window.location.pathname);
};

export const logEvent = (category = "", action = "") => {
  if (category && action) {
    ReactGA.event({ category, action });
  }
};

export const logException = (description = "", fatal = false) => {
  if (description) {
    ReactGA.exception({ description, fatal });
  }
};
