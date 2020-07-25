import getConfig from "next/config";
import React from "react";

import AppWrapper from "../components/AppWrapper";
import { Col } from "../components/Layout";

const { publicRuntimeConfig } = getConfig();

const TermsPage = () => (
  <AppWrapper>
    {/* TODO: better container */}
    <Col width={600} maxWidth="97%" alignItems="flex-start">
      <h3>{publicRuntimeConfig.SITE_NAME} Terms of Service</h3>
      <p>
        By accessing the website at{" "}
        <a href={`https://${publicRuntimeConfig.DEFAULT_DOMAIN}`}>
          https://{publicRuntimeConfig.DEFAULT_DOMAIN}
        </a>
        , you are agreeing to be bound by these terms of service, all applicable
        laws and regulations, and agree that you are responsible for compliance
        with any applicable local laws. If you do not agree with any of these
        terms, you are prohibited from using or accessing this site. The
        materials contained in this website are protected by applicable
        copyright and trademark law.
      </p>
      <p>
        In no event shall {publicRuntimeConfig.SITE_NAME} or its suppliers be
        liable for any damages (including, without limitation, damages for loss
        of data or profit, or due to business interruption) arising out of the
        use or inability to use the materials on{" "}
        {publicRuntimeConfig.DEFAULT_DOMAIN} website, even if{" "}
        {publicRuntimeConfig.SITE_NAME} or a {publicRuntimeConfig.SITE_NAME}{" "}
        authorized representative has been notified orally or in writing of the
        possibility of such damage. Because some jurisdictions do not allow
        limitations on implied warranties, or limitations of liability for
        consequential or incidental damages, these limitations may not apply to
        you.
      </p>
      <p>
        The materials appearing on {publicRuntimeConfig.SITE_NAME} website could
        include technical, typographical, or photographic errors.{" "}
        {publicRuntimeConfig.SITE_NAME} does not warrant that any of the
        materials on its website are accurate, complete or current.{" "}
        {publicRuntimeConfig.SITE_NAME} may make changes to the materials
        contained on its website at any time without notice. However{" "}
        {publicRuntimeConfig.SITE_NAME} does not make any commitment to update
        the materials.
      </p>
      <p>
        {publicRuntimeConfig.SITE_NAME} has not reviewed all of the sites linked
        to its website and is not responsible for the contents of any such
        linked site. The inclusion of any link does not imply endorsement by{" "}
        {publicRuntimeConfig.SITE_NAME} of the site. Use of any such linked
        website is at the {"user's"} own risk.
      </p>
      <p>
        {publicRuntimeConfig.SITE_NAME} may revise these terms of service for
        its website at any time without notice. By using this website you are
        agreeing to be bound by the then current version of these terms of
        service.
      </p>
    </Col>
  </AppWrapper>
);

export default TermsPage;
