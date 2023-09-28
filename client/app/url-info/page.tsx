"use client"

import React from "react";

import AppWrapper from "../../components/AppWrapper";
import Footer from "../../components/Footer";
import { H2, H4 } from "../../components/Text";
import { Col } from "../../components/Layout";
import { useSearchParams } from 'next/navigation';

export default function UrlInfoPage() {
  const params = useSearchParams()
  const target = params?.get('target')

  return (
    <AppWrapper>
      {!target ? (
        <H2 my={4} light>
          404 | Link could not be found.
        </H2>
      ) : (
        <>
          <Col flex="1 1 100%" alignItems="center">
            <H2 my={3} light>
              Target:
            </H2>
            <H4 bold>{target}</H4>
          </Col>
          <Footer />
        </>
      )}
    </AppWrapper>
  );
};
