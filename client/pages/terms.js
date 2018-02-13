import React from 'react';
import withRedux from 'next-redux-wrapper';
import styled from 'styled-components';
import initialState from '../store';
import BodyWrapper from '../components/BodyWrapper';
import { authUser } from '../actions';

const Wrapper = styled.div`
  width: 600px;
  max-width: 97%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
`;

const SettingsPage = () => (
  <BodyWrapper>
    <Wrapper>
      <h3>Kutt Terms of Service</h3>
      <p>
        By accessing the website at <a href="https://kutt.it">https://kutt.it</a>, you are agreeing
        to be bound by these terms of service, all applicable laws and regulations, and agree that
        you are responsible for compliance with any applicable local laws. If you do not agree with
        any of these terms, you are prohibited from using or accessing this site. The materials
        contained in this website are protected by applicable copyright and trademark law.
      </p>
      <p>
        In no event shall Kutt or its suppliers be liable for any damages (including, without
        limitation, damages for loss of data or profit, or due to business interruption) arising out
        of the use or inability to use the materials on {"Kutt's"} website, even if Kutt or a Kutt
        authorized representative has been notified orally or in writing of the possibility of such
        damage. Because some jurisdictions do not allow limitations on implied warranties, or
        limitations of liability for consequential or incidental damages, these limitations may not
        apply to you.
      </p>
      <p>
        The materials appearing on Kutt website could include technical, typographical, or
        photographic errors. Kutt does not warrant that any of the materials on its website are
        accurate, complete or current. Kutt may make changes to the materials contained on its
        website at any time without notice. However Kutt does not make any commitment to update the
        materials.
      </p>
      <p>
        Kutt has not reviewed all of the sites linked to its website and is not responsible for the
        contents of any such linked site. The inclusion of any link does not imply endorsement by
        Kutt of the site. Use of any such linked website is at the {"user's"} own risk.
      </p>
      <p>
        Kutt may revise these terms of service for its website at any time without notice. By using
        this website you are agreeing to be bound by the then current version of these terms of
        service.
      </p>
    </Wrapper>
  </BodyWrapper>
);

SettingsPage.getInitialProps = ({ req, store }) => {
  const token = req && req.cookies && req.cookies.token;
  if (token && store) store.dispatch(authUser(token));
};

export default withRedux(initialState)(SettingsPage);
