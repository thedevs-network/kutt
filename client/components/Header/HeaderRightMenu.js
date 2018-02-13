import React from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import Router from 'next/router';
import styled from 'styled-components';
import HeaderMenuItem from './HeaderMenuItem';
import { logoutUser, showPageLoading } from '../../actions';
import Button from '../Button';

const List = styled.ul`
  display: flex;
  float: right;
  justify-content: flex-end;
  align-items: center;
  margin: 0;
  padding: 0;
  list-style: none;
`;

const HeaderMenu = props => {
  const goTo = e => {
    e.preventDefault();
    const path = e.currentTarget.getAttribute('href');
    if (!path || window.location.pathname === path) return;
    props.showPageLoading();
    Router.push(path);
  };

  const login = !props.auth.isAuthenticated && (
    <HeaderMenuItem>
      <a href="/login" title="login / signup" onClick={goTo}>
        <Button>Login / sign up</Button>
      </a>
    </HeaderMenuItem>
  );
  const logout = props.auth.isAuthenticated && (
    <HeaderMenuItem>
      <a href="/logout" title="logout" onClick={goTo}>
        Logout
      </a>
    </HeaderMenuItem>
  );
  const settings = props.auth.isAuthenticated && (
    <HeaderMenuItem>
      <a href="/settings" title="settings" onClick={goTo}>
        <Button>Settings</Button>
      </a>
    </HeaderMenuItem>
  );
  return (
    <List>
      {logout}
      {settings}
      {login}
    </List>
  );
};

HeaderMenu.propTypes = {
  auth: PropTypes.shape({
    isAuthenticated: PropTypes.bool.isRequired,
  }).isRequired,
  showPageLoading: PropTypes.func.isRequired,
};

const mapStateToProps = ({ auth }) => ({ auth });

const mapDispatchToProps = dispatch => ({
  logoutUser: bindActionCreators(logoutUser, dispatch),
  showPageLoading: bindActionCreators(showPageLoading, dispatch),
});

export default connect(mapStateToProps, mapDispatchToProps)(HeaderMenu);
