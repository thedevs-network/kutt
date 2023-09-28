import React from "react";
import { publicRuntimeConfig } from '../../next.config';
import type { Metadata } from 'next';
import { Providers } from "../store/provider";
import Head from "next/head";
import { Colors } from "../consts";
interface Props {
  children: React.ReactNode;
}

export const metadata: Metadata = {
  title: `${publicRuntimeConfig.SITE_NAME} | Modern Open Source URL shortener.`,
  description: `${publicRuntimeConfig.SITE_NAME} is a free and open source URL shortener with custom domains and stats.`,
  openGraph: {
    type: 'website',
    url: `https://${publicRuntimeConfig.DEFAULT_DOMAIN}`,
    title: `${publicRuntimeConfig.SITE_NAME} | Modern Open Source URL shortener.`,
    description: `${publicRuntimeConfig.SITE_NAME} is a free and open source URL shortener with custom domains and stats.`,
    images: [
      {
        url: `https://${publicRuntimeConfig.DEFAULT_DOMAIN}/images/card.png`,
        width: 1200,
        height: 630,
        alt: `${publicRuntimeConfig.SITE_NAME} | Modern Open Source URL shortener.`,
      },
    ],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css?family=Nunito:300,400,700&display=optional"
          rel="stylesheet"
        />
        <link rel="icon" sizes="196x196" href="/images/favicon-196x196.png" />
        <link rel="icon" sizes="32x32" href="/images/favicon-32x32.png" />
        <link rel="icon" sizes="16x16" href="/images/favicon-16x16.png" />
        <link rel="apple-touch-icon" href="/images/favicon-196x196.png" />
        <link rel="mask-icon" href="/images/icon.svg" color="blue" />
        <link rel="manifest" href="manifest.webmanifest" />

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
      </head>
      <body
        style={{
          margin: 0,
          backgroundColor: Colors.Bg,
          font: '16px/1.45 "Nunito", sans-serif',
          overflowX: "hidden",
          color: Colors.Text
        }}
      >
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
