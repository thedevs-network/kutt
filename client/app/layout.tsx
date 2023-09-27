"use client"

import React from "react";
import getConfig from 'next/config';
import { StoreProvider } from "easy-peasy";
import Head from "next/head";
import { initializeStore } from '../store';

interface Props {
  children: React.ReactNode;
}
const { publicRuntimeConfig } = getConfig();

export default function RootLayout({ children }: Props) {
  const store = initializeStore();

  return (
    <html lang="en">
      <Head>
        <title>
          {publicRuntimeConfig.SITE_NAME} | Modern Open Source URL shortener.
        </title>
      </Head>
      <body>
        <StoreProvider store={store}>
          {children}
        </StoreProvider>
      </body>
    </html>
  );
}
