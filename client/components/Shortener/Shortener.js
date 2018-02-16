import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import styled from 'styled-components';
import ShortenerResult from './ShortenerResult';
import ShortenerTitle from './ShortenerTitle';
import ShortenerInput from './ShortenerInput';
import { createShortUrl, setShortenerFormError, showShortenerLoading } from '../../actions';
import { fadeIn } from '../../helpers/animations';

const Wrapper = styled.div`
  position: relative;
  width: 800px;
  max-width: 98%;
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  margin: 16px 0 40px;
  padding-bottom: 125px;
  animation: ${fadeIn} 0.8s ease-out;

  @media only screen and (max-width: 800px) {
    padding: 0 8px 96px;
  }
`;

const ResultWrapper = styled.div`
  position: relative;
  height: 96px;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  box-sizing: border-box;

  @media only screen and (max-width: 448px) {
    height: 72px;
  }
`;

class Shortener extends Component {
  constructor() {
    super();
    this.state = {
      isCopied: false,
    };
    this.handleSubmit = this.handleSubmit.bind(this);
    this.copyHandler = this.copyHandler.bind(this);
  }

  shouldComponentUpdate(nextProps, nextState) {
    const { isAuthenticated, shortenerError, shortenerLoading, url: { isShortened } } = this.props;
    return (
      isAuthenticated !== nextProps.isAuthenticated ||
      shortenerError !== nextProps.shortenerError ||
      isShortened !== nextProps.url.isShortened ||
      shortenerLoading !== nextProps.shortenerLoading ||
      this.state.isCopied !== nextState.isCopied
    );
  }

  handleSubmit(e) {
    e.preventDefault();
    const { isAuthenticated } = this.props;
    this.props.showShortenerLoading();
    const shortenerForm = document.getElementById('shortenerform');
    const {
      target: originalUrl,
      customurl: customurlInput,
      password: pwd,
    } = shortenerForm.elements;
    const target = originalUrl.value.trim();
    const customurl = customurlInput && customurlInput.value.trim();
    const password = pwd && pwd.value;
    const options = isAuthenticated && { customurl, password };
    shortenerForm.reset();
    if (!isAuthenticated) {
      window.grecaptcha.execute(window.captchaId);
      const getCaptchaToken = () => {
        setTimeout(() => {
          if (window.isCaptchaReady) {
            const reCaptchaToken = window.grecaptcha.getResponse(window.captchaId);
            window.isCaptchaReady = false;
            window.grecaptcha.reset(window.captchaId);
            return this.props.createShortUrl({ target, reCaptchaToken, ...options });
          }
          return getCaptchaToken();
        }, 200);
      };
      return getCaptchaToken();
    }
    return this.props.createShortUrl({ target, ...options });
  }

  copyHandler() {
    this.setState({ isCopied: true });
    setTimeout(() => {
      this.setState({ isCopied: false });
    }, 1500);
  }

  render() {
    const { isCopied } = this.state;
    const { isAuthenticated, shortenerError, shortenerLoading, url } = this.props;
    return (
      <Wrapper>
        <ResultWrapper>
          {!shortenerError && (url.isShortened || shortenerLoading) ? (
            <ShortenerResult
              copyHandler={this.copyHandler}
              loading={shortenerLoading}
              url={url}
              isCopied={isCopied}
            />
          ) : (
            <ShortenerTitle />
          )}
        </ResultWrapper>
        <ShortenerInput
          isAuthenticated={isAuthenticated}
          handleSubmit={this.handleSubmit}
          setShortenerFormError={this.props.setShortenerFormError}
        />
      </Wrapper>
    );
  }
}

Shortener.propTypes = {
  isAuthenticated: PropTypes.bool.isRequired,
  createShortUrl: PropTypes.func.isRequired,
  shortenerError: PropTypes.string.isRequired,
  shortenerLoading: PropTypes.bool.isRequired,
  setShortenerFormError: PropTypes.func.isRequired,
  showShortenerLoading: PropTypes.func.isRequired,
  url: PropTypes.shape({
    isShortened: PropTypes.bool.isRequired,
  }).isRequired,
};

const mapStateToProps = ({
  auth: { isAuthenticated },
  error: { shortener: shortenerError },
  loading: { shortener: shortenerLoading },
  url,
}) => ({
  isAuthenticated,
  shortenerError,
  shortenerLoading,
  url,
});

const mapDispatchToProps = dispatch => ({
  createShortUrl: bindActionCreators(createShortUrl, dispatch),
  setShortenerFormError: bindActionCreators(setShortenerFormError, dispatch),
  showShortenerLoading: bindActionCreators(showShortenerLoading, dispatch),
});

export default connect(mapStateToProps, mapDispatchToProps)(Shortener);
