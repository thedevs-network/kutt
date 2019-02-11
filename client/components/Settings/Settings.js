import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import Router from 'next/router';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import styled from 'styled-components';
import cookie from 'js-cookie';
import axios from 'axios';
import SettingsWelcome from './SettingsWelcome';
import SettingsDomain from './SettingsDomain';
import SettingsPassword from './SettingsPassword';
import SettingsBan from './SettingsBan';
import SettingsApi from './SettingsApi';
import Modal from '../Modal';
import { fadeIn } from '../../helpers/animations';
import {
  deleteCustomDomain,
  generateApiKey,
  getUserSettings,
  setCustomDomain,
  showDomainInput,
  banUrl,
} from '../../actions';

const Wrapper = styled.div`
  poistion: relative;
  width: 600px;
  max-width: 90%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 0 0 80px;
  animation: ${fadeIn} 0.8s ease;

  > * {
    max-width: 100%;
  }

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
  h3 {
    font-size: 24px;
    margin: 32px 0 16px;

    @media only screen and (max-width: 768px) {
      font-size: 18px;
    }
  }
  p {
    margin: 24px 0;
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

class Settings extends Component {
  constructor() {
    super();
    this.state = {
      showModal: false,
      passwordMessage: '',
      passwordError: '',
      useHttps: null,
      ban: {
        domain: false,
        error: '',
        host: false,
        loading: false,
        message: '',
        user: false,
      },
    };
    this.onSubmitBan = this.onSubmitBan.bind(this);
    this.onChangeBanCheckboxes = this.onChangeBanCheckboxes.bind(this);
    this.handleCustomDomain = this.handleCustomDomain.bind(this);
    this.handleCheckbox = this.handleCheckbox.bind(this);
    this.deleteDomain = this.deleteDomain.bind(this);
    this.showModal = this.showModal.bind(this);
    this.closeModal = this.closeModal.bind(this);
    this.changePassword = this.changePassword.bind(this);
  }

  componentDidMount() {
    if (!this.props.auth.isAuthenticated) Router.push('/login');
    this.props.getUserSettings();
  }

  async onSubmitBan(e) {
    e.preventDefault();
    const { ban: { domain, host, user } } = this.state;
    this.setState(state => ({
      ban: {
        ...state.ban,
        loading: true,
      },
    }));
    const id = e.currentTarget.elements.id.value;
    let message;
    let error;
    try {
      message = await this.props.banUrl({
        id,
        domain,
        host,
        user,
      });
    } catch (err) {
      error = err;
    }
    this.setState(
      state => ({
        ban: {
          ...state.ban,
          loading: false,
          message,
          error,
        },
      }),
      () => {
        setTimeout(() => {
          this.setState(state => ({
            ban: {
              ...state.ban,
              loading: false,
              message: '',
              error: '',
            },
          }));
        }, 2000);
      }
    );
  }

  onChangeBanCheckboxes(type) {
    return e => {
      const { checked } = e.target;
      this.setState(state => ({
        ban: {
          ...state.ban,
          [type]: !checked,
        },
      }));
    };
  }

  handleCustomDomain(e) {
    e.preventDefault();
    if (this.props.domainLoading) return null;
    const { useHttps } = this.state;
    const customDomain = e.currentTarget.elements.customdomain.value;
    const homepage = e.currentTarget.elements.homepage.value;
    return this.props.setCustomDomain({ customDomain, homepage, useHttps });
  }

  handleCheckbox({ target: { id, checked } }) {
    this.setState({ [id]: !checked });
  }

  deleteDomain() {
    this.closeModal();
    this.props.deleteCustomDomain();
  }

  showModal() {
    this.setState({ showModal: true });
  }

  closeModal() {
    this.setState({ showModal: false });
  }

  changePassword(e) {
    e.preventDefault();
    const form = e.target;
    const password = form.elements.password.value;
    if (password.length < 8) {
      return this.setState({ passwordError: 'Password must be at least 8 chars long.' }, () => {
        setTimeout(() => {
          this.setState({
            passwordError: '',
          });
        }, 1500);
      });
    }
    return axios
      .post(
        '/api/auth/changepassword',
        { password },
        { headers: { Authorization: cookie.get('token') } }
      )
      .then(res =>
        this.setState({ passwordMessage: res.data.message }, () => {
          setTimeout(() => {
            this.setState({ passwordMessage: '' });
          }, 1500);
          form.reset();
        })
      )
      .catch(err =>
        this.setState({ passwordError: err.response.data.error }, () => {
          setTimeout(() => {
            this.setState({
              passwordError: '',
            });
          }, 1500);
        })
      );
  }

  render() {
    const { auth: { user, admin } } = this.props;
    return (
      <Wrapper>
        <SettingsWelcome user={user} />
        <hr />
        {admin && (
          <Fragment>
            <SettingsBan
              {...this.state.ban}
              onSubmitBan={this.onSubmitBan}
              onChangeBanCheckboxes={this.onChangeBanCheckboxes}
            />
            <hr />
          </Fragment>
        )}
        <SettingsDomain
          handleCustomDomain={this.handleCustomDomain}
          handleCheckbox={this.handleCheckbox}
          useHttps={this.state.useHttps}
          loading={this.props.domainLoading}
          settings={this.props.settings}
          showDomainInput={this.props.showDomainInput}
          showModal={this.showModal}
        />
        <hr />
        <SettingsPassword
          message={this.state.passwordMessage}
          error={this.state.passwordError}
          changePassword={this.changePassword}
        />
        <hr />
        <SettingsApi
          loader={this.props.apiLoading}
          generateKey={this.props.generateApiKey}
          apikey={this.props.settings.apikey}
        />
        <Modal show={this.state.showModal} close={this.closeModal} handler={this.deleteDomain}>
          Are you sure do you want to delete the domain?
        </Modal>
      </Wrapper>
    );
  }
}

Settings.propTypes = {
  auth: PropTypes.shape({
    admin: PropTypes.bool.isRequired,
    isAuthenticated: PropTypes.bool.isRequired,
    user: PropTypes.string.isRequired,
  }).isRequired,
  apiLoading: PropTypes.bool,
  deleteCustomDomain: PropTypes.func.isRequired,
  domainLoading: PropTypes.bool,
  banUrl: PropTypes.func.isRequired,
  setCustomDomain: PropTypes.func.isRequired,
  generateApiKey: PropTypes.func.isRequired,
  getUserSettings: PropTypes.func.isRequired,
  settings: PropTypes.shape({
    apikey: PropTypes.string.isRequired,
    customDomain: PropTypes.string.isRequired,
    domainInput: PropTypes.bool.isRequired,
  }).isRequired,
  showDomainInput: PropTypes.func.isRequired,
};

Settings.defaultProps = {
  apiLoading: false,
  domainLoading: false,
};

const mapStateToProps = ({
  auth,
  loading: { api: apiLoading, domain: domainLoading },
  settings,
}) => ({
  auth,
  apiLoading,
  domainLoading,
  settings,
});

const mapDispatchToProps = dispatch => ({
  banUrl: bindActionCreators(banUrl, dispatch),
  deleteCustomDomain: bindActionCreators(deleteCustomDomain, dispatch),
  setCustomDomain: bindActionCreators(setCustomDomain, dispatch),
  generateApiKey: bindActionCreators(generateApiKey, dispatch),
  getUserSettings: bindActionCreators(getUserSettings, dispatch),
  showDomainInput: bindActionCreators(showDomainInput, dispatch),
});

export default connect(mapStateToProps, mapDispatchToProps)(Settings);
