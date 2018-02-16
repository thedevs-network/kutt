/* eslint-disable react/no-danger */
import React from 'react';
import Document, { Head, Main, NextScript } from 'next/document';
import { ServerStyleSheet } from 'styled-components';

const style = {
  margin: 0,
  backgroundColor: '#f3f3f3',
  font: '16px/1.45 "Nunito", sans-serif',
  overflowX: 'hidden',
  color: 'black',
};

class AppDocument extends Document {
  static getInitialProps({ renderPage }) {
    const sheet = new ServerStyleSheet();
    const page = renderPage(App => props => sheet.collectStyles(<App {...props} />));
    const styleTags = sheet.getStyleElement();
    return { ...page, styleTags };
  }

  render() {
    return (
      <html lang="en">
        <Head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
          <title>Kutt.it | Modern URL shortener.</title>
          <meta
            name="description"
            content="Kutt.it is a free and open source URL shortener with custom domains and stats."
          />
          <link
            href="https://fonts.googleapis.com/css?family=Nunito:300,400,700"
            rel="stylesheet"
          />
          <link rel="icon" sizes="196x196" href="/images/favicon-196x196.png" />
          <link rel="icon" sizes="32x32" href="/images/favicon-32x32.png" />
          <link rel="icon" sizes="16x16" href="/images/favicon-16x16.png" />
          <link rel="apple-touch-icon" href="/images/favicon-196x196.png" />
          <link rel="mask-icon" href="/images/icon.svg" color="blue" />

          <meta property="fb:app_id" content="123456789" />
          <meta property="og:url" content="https://kutt.it" />
          <meta property="og:type" content="website" />
          <meta property="og:title" content="Kutt.it" />
          <meta property="og:image" content="https://kutt.it/images/card.png" />
          <meta property="og:description" content="Free Modern URL Shortener" />
          <meta name="twitter:url" content="https://kutt.it" />
          <meta name="twitter:title" content="Kutt.it" />
          <meta name="twitter:description" content="Free Modern URL Shortener" />
          <meta name="twitter:image" content="https://kutt.it/images/card.png" />

          {this.props.styleTags}

          <script
            dangerouslySetInnerHTML={{
              __html: `window.recaptchaCallback = function() { window.isCaptchaReady = true; }`,
            }}
          />

          <script src="https://www.google.com/recaptcha/api.js?render=explicit" async defer />
          <script src="/analytics.js" />
        </Head>
        <body style={style}>
          <Main />
          <NextScript />
        </body>
      </html>
    );
  }
}

export default AppDocument;
