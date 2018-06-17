import React from 'react';
import withRedux from 'next-redux-wrapper';
import styled from 'styled-components';
import initialState from '../store';
import BodyWrapper from '../components/BodyWrapper';
import { authUser } from '../actions';
import { REPORT_EMAIL } from '../config';

const Wrapper = styled.div`
  width: 600px;
  max-width: 97%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
`;

const ReportPage = () => (
  <BodyWrapper>
    <Wrapper>
      <h3>Report abuse</h3>
      <p>
        Report abuses, malware and phishing links to the below email address. We will take them down
        within 12 hours.
      </p>
      <p>{REPORT_EMAIL}</p>
    </Wrapper>
  </BodyWrapper>
);

ReportPage.getInitialProps = ({ req, store }) => {
  const token = req && req.cookies && req.cookies.token;
  if (token && store) store.dispatch(authUser(token));
};

export default withRedux(initialState)(ReportPage);
