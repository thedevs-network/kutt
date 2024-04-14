import Document, { Html, Head, Main, NextScript } from "next/document";

// import Document, { Head, Main, NextScript } from "next/document";
import { ServerStyleSheet } from "styled-components";
import getConfig from "next/config";
import React from "react";

import { Colors } from "../consts";

const { publicRuntimeConfig } = getConfig();

interface Props {
  styleTags: any;
}

class AppDocument extends Document<Props> {
  static async getInitialProps(ctx) {
    const initialProps = await Document.getInitialProps(ctx);
    const sheet = new ServerStyleSheet();
    const page = ctx.renderPage(
      (App) => (props) => sheet.collectStyles(<App {...props} />)
    );
    const styleTags = sheet.getStyleElement();
    return { ...initialProps, ...page, styleTags };
  }

  render() {
    return (
      <Html>
        <Head>
          {this.props.styleTags}

          <script
            dangerouslySetInnerHTML={{
              __html: `window.recaptchaCallback = function() { window.isCaptchaReady = true; }`
            }}
          />

          <script
            src="https://www.google.com/recaptcha/api.js?render=explicit"
            async
            defer
          />
        </Head>
        <body
          style={{
            margin: 0,
            backgroundColor: Colors.Bg,
            font: '16px/1.45 "Nunito", sans-serif',
            overflowX: "hidden",
            color: Colors.Text
          }}
        >
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}

export default AppDocument;
