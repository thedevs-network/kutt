import App, { AppContext } from "next/app";
import { StoreProvider } from "easy-peasy";
import getConfig from "next/config";
import Router from "next/router";
import decode from "jwt-decode";
import cookie from "js-cookie";
import Head from "next/head";
import React from "react";

import { initGA, logPageView } from "../helpers/analytics";
import { initializeStore } from "../store";
import { TokenPayload } from "../types";

const isProd = process.env.NODE_ENV === "production";
const { publicRuntimeConfig } = getConfig();

// TODO: types
class MyApp extends App<any> {
  static async getInitialProps({ Component, ctx }: AppContext) {
    const store = initializeStore();
    ctx.store = store;

    let pageProps = {};
    if (Component.getInitialProps) {
      pageProps = await Component.getInitialProps(ctx);
    }

    const token =
      ctx.req && (ctx.req as any).cookies && (ctx.req as any).cookies.token;
    const tokenPayload: TokenPayload = token ? decode(token) : null;

    if (tokenPayload) {
      store.dispatch.auth.add(tokenPayload);
    }

    return { pageProps, tokenPayload, initialState: store.getState() };
  }

  store: ReturnType<typeof initializeStore>;
  constructor(props) {
    super(props);
    this.store = initializeStore(props.initialState);
  }

  componentDidMount() {
    const { loading, auth } = this.store.dispatch;
    const token = cookie.get("token");
    const isVerifyEmailPage =
      typeof window !== "undefined" &&
      window.location.pathname.includes("verify-email");

    if (token && !isVerifyEmailPage) {
      auth.renew().catch(() => {
        auth.logout();
      });
    }

    if (isProd) {
      initGA();
      logPageView();
    }

    Router.events.on("routeChangeStart", () => loading.show());
    Router.events.on("routeChangeComplete", () => {
      loading.hide();

      if (isProd) {
        logPageView();
      }
    });
    Router.events.on("routeChangeError", () => loading.hide());
  }

  render() {
    const { Component, pageProps } = this.props;

    return (
      <>
        <Head>
          <title>
            {publicRuntimeConfig.SITE_NAME} | Modern Open Source URL shortener.
          </title>
        </Head>
        <StoreProvider store={this.store}>
          <Component {...pageProps} />
        </StoreProvider>
      </>
    );
  }
}

export default MyApp;
