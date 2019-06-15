import React from 'react';
import PropTypes from 'prop-types';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import styled from 'styled-components';
import cookie from 'js-cookie';
import Header from '../Header';
import PageLoading from '../PageLoading';
import { renewAuthUser, hidePageLoading } from '../../actions';
import { initGA, logPageView } from '../../helpers/analytics';

const Wrapper = styled.div`
  position: relative;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-sizing: border-box;

  * {
    box-sizing: border-box;
  }

  *::-moz-focus-inner {
    border: none;
  }

  @media only screen and (max-width: 448px) {
    font-size: 14px;
  }
`;

const ContentWrapper = styled.div`
  min-height: 100vh;
  width: 100%;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  flex-direction: column;
  box-sizing: border-box;
`;

class BodyWrapper extends React.Component {
  componentDidMount() {
    if (process.env.GOOGLE_ANALYTICS) {
      if (!window.GA_INITIALIZED) {
        initGA();
        window.GA_INITIALIZED = true;
      }
      logPageView();
    }

    const token = cookie.get('token');
    this.props.hidePageLoading();
    if (!token || this.props.norenew) return null;
    return this.props.renewAuthUser(token);
  }

  render() {
    const { children, pageLoading } = this.props;

    const content = pageLoading ? <PageLoading /> : children;

    return (
      <Wrapper>
        <ContentWrapper>
          <Header />
          {content}
        </ContentWrapper>
      </Wrapper>
    );
  }
}

BodyWrapper.propTypes = {
  children: PropTypes.node.isRequired,
  hidePageLoading: PropTypes.func.isRequired,
  norenew: PropTypes.bool,
  pageLoading: PropTypes.bool.isRequired,
  renewAuthUser: PropTypes.func.isRequired,
};

BodyWrapper.defaultProps = {
  norenew: false,
};

const mapStateToProps = ({ loading: { page: pageLoading } }) => ({ pageLoading });

const mapDispatchToProps = dispatch => ({
  hidePageLoading: bindActionCreators(hidePageLoading, dispatch),
  renewAuthUser: bindActionCreators(renewAuthUser, dispatch),
});

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(BodyWrapper);
