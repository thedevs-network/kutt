import React from 'react';
import PropTypes from 'prop-types';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import styled from 'styled-components';
import HeaderLogo from './HeaderLogo';
import HeaderLeftMenu from './HeaderLeftMenu';
import HeaderRightMenu from './HeaderRightMenu';
import { showPageLoading } from '../../actions';

const Wrapper = styled.header`
  display: flex;
  width: 1232px;
  max-width: 100%;
  padding: 0 32px;
  height: 102px;
  justify-content: space-between;
  align-items: center;

  @media only screen and (max-width: 768px) {
    height: auto;
    align-items: flex-start;
    padding: 16px;
    margin-bottom: 32px;
  }
`;

const LeftMenuWrapper = styled.div`
  display: flex;

  @media only screen and (max-width: 488px) {
    flex-direction: column;
    align-items: flex-start;
  }
`;

const Header = props => (
  <Wrapper>
    <LeftMenuWrapper>
      <HeaderLogo showPageLoading={props.showPageLoading} />
      <HeaderLeftMenu />
    </LeftMenuWrapper>
    <HeaderRightMenu showPageLoading={props.showPageLoading} />
  </Wrapper>
);

Header.propTypes = {
  showPageLoading: PropTypes.func.isRequired,
};

const mapDispatchToProps = dispatch => ({
  showPageLoading: bindActionCreators(showPageLoading, dispatch),
});

export default connect(
  null,
  mapDispatchToProps
)(Header);
