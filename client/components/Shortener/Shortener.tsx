import React, { FC, useState } from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import styled from 'styled-components';
import { Flex } from 'reflexbox/styled-components';

import ShortenerResult from './ShortenerResult';
import ShortenerTitle from './ShortenerTitle';
import ShortenerInput from './ShortenerInput';
import {
  createShortUrl,
  setShortenerFormError,
  showShortenerLoading,
} from '../../actions';
import { fadeIn } from '../../helpers/animations';

// TODO: types
interface Props {
  isAuthenticated: boolean;
  domain: string;
  createShortUrl: any;
  shortenerError: string;
  shortenerLoading: boolean;
  setShortenerFormError: any;
  showShortenerLoading: any;
  url: {
    isShortened: boolean;
    list: any[];
  };
}

const Wrapper = styled(Flex).attrs({
  width: 800,
  maxWidth: '98%',
  flex: '0 0 auto',
  flexDirection: 'column',
  mt: 16,
  mb: 40,
})`
  position: relative;
  padding-bottom: 125px;
  animation: ${fadeIn} 0.8s ease-out;

  @media only screen and (max-width: 800px) {
    padding: 0 8px 96px;
  }
`;

const ResultWrapper = styled(Flex).attrs({
  justifyContent: 'center',
  alignItems: 'flex-start',
})`
  position: relative;
  height: 96px;

  @media only screen and (max-width: 448px) {
    height: 72px;
  }
`;

const Shortener: FC<Props> = props => {
  const [copied, setCopied] = useState(false);

  const copyHandler = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleSubmit = e => {
    e.preventDefault();
    const { isAuthenticated } = props;
    props.showShortenerLoading();
    const shortenerForm: any = document.getElementById('shortenerform');
    const {
      target: originalUrl,
      customurl: customurlInput,
      password: pwd,
    } = shortenerForm.elements; // FIXME: types
    const target = originalUrl.value.trim();
    const customurl = customurlInput && customurlInput.value.trim();
    const password = pwd && pwd.value;
    const options = isAuthenticated && { customurl, password };
    shortenerForm.reset();
    if (process.env.NODE_ENV === 'production' && !isAuthenticated) {
      // FIXME: types bro
      (window as any).grecaptcha.execute((window as any).captchaId);
      const getCaptchaToken = () => {
        setTimeout(() => {
          if ((window as any).isCaptchaReady) {
            const reCaptchaToken = (window as any).grecaptcha.getResponse(
              (window as any).captchaId
            );
            (window as any).isCaptchaReady = false;
            (window as any).grecaptcha.reset((window as any).captchaId);
            return props.createShortUrl({
              target,
              reCaptchaToken,
              ...options,
            });
          }
          return getCaptchaToken();
        }, 200);
      };
      return getCaptchaToken();
    }
    return props.createShortUrl({ target, ...options });
  };

  return (
    <Wrapper>
      <ResultWrapper>
        {!props.shortenerError &&
        (props.url.isShortened || props.shortenerLoading) ? (
          <ShortenerResult
            copyHandler={copyHandler}
            loading={props.shortenerLoading}
            url={props.url}
            isCopied={copied}
          />
        ) : (
          <ShortenerTitle />
        )}
      </ResultWrapper>
      <ShortenerInput
        isAuthenticated={props.isAuthenticated}
        handleSubmit={handleSubmit}
        setShortenerFormError={props.setShortenerFormError}
        domain={props.domain}
      />
    </Wrapper>
  );
};

// TODO: check if needed
// shouldComponentUpdate(nextProps, nextState) {
//   const {
//     isAuthenticated,
//     domain,
//     shortenerError,
//     shortenerLoading,
//     url: { isShortened },
//   } = props;
//   return (
//     isAuthenticated !== nextProps.isAuthenticated ||
//     shortenerError !== nextProps.shortenerError ||
//     isShortened !== nextProps.url.isShortened ||
//     shortenerLoading !== nextProps.shortenerLoading ||
//     domain !== nextProps.domain ||
//     state.isCopied !== nextState.isCopied
//   );
// }

const mapStateToProps = ({
  auth: { isAuthenticated },
  error: { shortener: shortenerError },
  loading: { shortener: shortenerLoading },
  settings: { customDomain: domain },
  url,
}) => ({
  isAuthenticated,
  domain,
  shortenerError,
  shortenerLoading,
  url,
});

const mapDispatchToProps = dispatch => ({
  createShortUrl: bindActionCreators(createShortUrl, dispatch),
  setShortenerFormError: bindActionCreators(setShortenerFormError, dispatch),
  showShortenerLoading: bindActionCreators(showShortenerLoading, dispatch),
});

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(Shortener);
