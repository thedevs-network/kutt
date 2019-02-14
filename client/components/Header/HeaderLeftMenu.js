import React from 'react';
import PropTypes from 'prop-types';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import styled from 'styled-components';
import Router from 'next/router';
import HeaderMenuItem from './HeaderMenuItem';
import { showPageLoading } from '../../actions';

const List = styled.ul`
  display: flex;
  align-items: flex-end;
  list-style: none;
  margin: 0 0 3px;
  padding: 0;

  @media only screen and (max-width: 488px) {
    display: none;
  }
`;

const HeaderLeftMenu = props => {
  const goTo = e => {
    e.preventDefault();
    const path = e.currentTarget.getAttribute('href');
    if (!path || window.location.pathname === path) return;
    props.showPageLoading();
    Router.push(path);
  };
  return (
    <List>
      <HeaderMenuItem>
        <a
          href="//github.com/thedevs-network/kutt"
          target="_blank"
          rel="noopener noreferrer"
          title="GitHub"
        >
          GitHub
        </a>
      </HeaderMenuItem>
      <HeaderMenuItem>
        <a href="/report" title="Report abuse" onClick={goTo}>
          Report
        </a>
      </HeaderMenuItem>
    </List>
  );
};

HeaderLeftMenu.propTypes = {
  showPageLoading: PropTypes.func.isRequired,
};

const mapDispatchToProps = dispatch => ({
  showPageLoading: bindActionCreators(showPageLoading, dispatch),
});

export default connect(
  null,
  mapDispatchToProps
)(HeaderLeftMenu);
