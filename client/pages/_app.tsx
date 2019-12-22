import App, { AppContext } from "next/app";
import { StoreProvider } from "easy-peasy";
import Head from "next/head";
import Router from "next/router";
import React from "react";
import { Provider } from "react-redux";
import decode from "jwt-decode";

import withReduxStore from "../with-redux-store";
import { initializeStore } from "../store";
import { TokenPayload } from "../types";

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
    const { loading } = this.store.dispatch;
    Router.events.on("routeChangeStart", () => loading.show());
    Router.events.on("routeChangeComplete", () => loading.hide());
    Router.events.on("routeChangeError", () => loading.hide());
  }

  render() {
    const { Component, pageProps, reduxStore } = this.props;
    return (
      <>
        <Head>
          <title>Kutt.it | Modern Open Source URL shortener.</title>
        </Head>
        <Provider store={reduxStore}>
          <StoreProvider store={this.store}>
            <Component {...pageProps} />
          </StoreProvider>
        </Provider>
      </>
    );
  }
}

export default withReduxStore(MyApp);
