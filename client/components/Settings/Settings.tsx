import React, { Component, Fragment, FC, useEffect, useState } from "react";
import Router from "next/router";
import { bindActionCreators } from "redux";
import { connect } from "react-redux";
import styled from "styled-components";
import cookie from "js-cookie";
import axios from "axios";
import { Flex } from "reflexbox/styled-components";

import SettingsWelcome from "./SettingsWelcome";
import SettingsDomain from "./SettingsDomain";
import SettingsPassword from "./SettingsPassword";
import SettingsBan from "./SettingsBan";
import SettingsApi from "./SettingsApi";
import Modal from "../Modal";
import { fadeIn } from "../../helpers/animations";
import {
  deleteCustomDomain,
  generateApiKey,
  getUserSettings,
  setCustomDomain,
  showDomainInput,
  banUrl
} from "../../actions";

// TODO: types
interface Props {
  auth: {
    admin: boolean;
    isAuthenticated: boolean;
    user: string;
  };
  apiLoading?: boolean;
  deleteCustomDomain: any;
  domainLoading?: boolean;
  banUrl: any;
  setCustomDomain: any;
  generateApiKey: any;
  getUserSettings: any;
  settings: {
    apikey: string;
    customDomain: string;
    homepage: string;
    domainInput: boolean;
  };
  showDomainInput: any;
}

const Wrapper = styled(Flex).attrs({
  width: 600,
  maxWidth: "90%",
  flexDirection: "column",
  alignItems: "flex-start",
  pb: 80
})`
  position: relative;
  animation: ${fadeIn} 0.8s ease;

  hr {
    width: 100%;
    height: 1px;
    outline: none;
    border: none;
    background-color: #e3e3e3;
    margin: 24px 0;

    @media only screen and (max-width: 768px) {
      margin: 12px 0;
    }
  }
  a {
    margin: 32px 0 0;
    color: #2196f3;
    text-decoration: none;

    :hover {
      color: #2196f3;
      border-bottom: 1px dotted #2196f3;
    }
  }
`;

const Settings: FC<Props> = props => {
  const [modal, setModal] = useState(false);
  const [password, setPassword] = useState({ message: "", error: "" });

  // useEffect(() => {
  //   // FIXME: probably should be moved somewhere else
  //   if (!props.auth.isAuthenticated) {
  //     Router.push("/login");
  //   } else {
  //     props.getUserSettings();
  //   }
  // }, []);

  const handleCustomDomain = e => {
    e.preventDefault();
    if (props.domainLoading) return null;
    const customDomain = e.currentTarget.elements.customdomain.value;
    const homepage = e.currentTarget.elements.homepage.value;
    return props.setCustomDomain({ customDomain, homepage });
  };

  const showModal = () => {
    setModal(true);
  };

  const closeModal = () => {
    setModal(false);
  };

  const deleteDomain = () => {
    showModal();
    props.deleteCustomDomain();
  };

  const changePassword = e => {
    e.preventDefault();
    const form = e.target;
    const password = form.elements.password.value;

    if (password.length < 8) {
      setPassword(s => ({
        ...s,
        error: "Password must be at least 8 chars long."
      }));
      setTimeout(() => {
        setPassword(s => ({ ...s, error: "" }));
      }, 1500);
      return;
    }

    return axios
      .post(
        "/api/auth/changepassword",
        { password },
        { headers: { Authorization: cookie.get("token") } }
      )
      .then(res => {
        setPassword(s => ({ ...s, message: res.data.message }));
        setTimeout(() => {
          setPassword(s => ({ ...s, message: "" }));
        }, 1500);
        form.reset();
      })
      .catch(err => {
        setPassword(s => ({ ...s, error: err.response.data.error }));
        setTimeout(() => {
          setPassword(s => ({ ...s, error: "" }));
        }, 1500);
        form.reset();
      });
  };

  return (
    <Wrapper>
      <SettingsWelcome user={props.auth.user} />
      <hr />
      {props.auth.admin && (
        <Fragment>
          <SettingsBan />
          <hr />
        </Fragment>
      )}
      <SettingsDomain
        handleCustomDomain={handleCustomDomain}
        loading={props.domainLoading}
        settings={props.settings}
        showDomainInput={props.showDomainInput}
        showModal={showModal}
      />
      <hr />
      <SettingsPassword />
      <hr />
      <SettingsApi />
      <Modal show={modal} close={closeModal} handler={deleteDomain}>
        Are you sure do you want to delete the domain?
      </Modal>
    </Wrapper>
  );
};

Settings.defaultProps = {
  apiLoading: false,
  domainLoading: false
};

const mapStateToProps = ({
  auth,
  loading: { api: apiLoading, domain: domainLoading },
  settings
}) => ({
  auth,
  apiLoading,
  domainLoading,
  settings
});

const mapDispatchToProps = dispatch => ({
  banUrl: bindActionCreators(banUrl, dispatch),
  deleteCustomDomain: bindActionCreators(deleteCustomDomain, dispatch),
  setCustomDomain: bindActionCreators(setCustomDomain, dispatch),
  generateApiKey: bindActionCreators(generateApiKey, dispatch),
  getUserSettings: bindActionCreators(getUserSettings, dispatch),
  showDomainInput: bindActionCreators(showDomainInput, dispatch)
});

export default connect(mapStateToProps, mapDispatchToProps)(Settings);
