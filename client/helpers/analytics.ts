import getConfig from "next/config";
import ReactGA from "react-ga";
import * as Sentry from '@sentry/react';
import { Integrations } from '@sentry/apm';

const { publicRuntimeConfig } = getConfig();

export const initGA = () => {
  ReactGA.initialize(publicRuntimeConfig.GOOGLE_ANALYTICS);
};

export const logPageView = () => {
  ReactGA.set({ page: window.location.pathname });
  ReactGA.pageview(window.location.pathname);
};

export const initSentry = () => {
  if (publicRuntimeConfig.SENTRY_PUBLIC_DSN) {
    Sentry.init({
      dsn: publicRuntimeConfig.SENTRY_PUBLIC_DSN,
      environment: process.env.NODE_ENV,
      integrations: [
        new Integrations.Tracing(),
      ],
      tracesSampleRate: 1.0,
    });
  };
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
