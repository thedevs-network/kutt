import React, { FC } from "react";
import { bindActionCreators } from "redux";
import { connect } from "react-redux";
import Router from "next/router";
import styled from "styled-components";
import { Flex } from "reflexbox/styled-components";

import HeaderMenuItem from "./HeaderMenuItem";
import Button from "./Button";

interface Props {
  isAuthenticated: boolean;
}

const List = styled(Flex).attrs({
  as: "ul",
  justifyContent: "flex-end",
  flexDirection: "row",
  alignItems: "center",
  m: 0,
  p: 0
})`
  list-style: none;
`;

const ReportLink = styled.a`
  display: none;
  @media only screen and (max-width: 488px) {
    display: block;
  }
`;

const HeaderMenu: FC<Props> = ({ isAuthenticated }) => {
  const goTo = e => {
    e.preventDefault();
    const path = e.currentTarget.getAttribute("href");
    if (!path || window.location.pathname === path) return;
    Router.push(path);
  };

  const login = !isAuthenticated && (
    <HeaderMenuItem>
      <a href="/login" title="login / signup" onClick={goTo}>
        <Button>Login / Sign up</Button>
      </a>
    </HeaderMenuItem>
  );
  const logout = isAuthenticated && (
    <HeaderMenuItem>
      <a href="/logout" title="logout" onClick={goTo}>
        Log out
      </a>
    </HeaderMenuItem>
  );
  const settings = isAuthenticated && (
    <HeaderMenuItem>
      <a href="/settings" title="settings" onClick={goTo}>
        <Button>Settings</Button>
      </a>
    </HeaderMenuItem>
  );
  return (
    <List>
      <HeaderMenuItem>
        <ReportLink href="/report" title="Report" onClick={goTo}>
          Report
        </ReportLink>
      </HeaderMenuItem>
      {logout}
      {settings}
      {login}
    </List>
  );
};

const mapStateToProps = ({ auth: { isAuthenticated } }) => ({
  isAuthenticated
});

export default connect(
  mapStateToProps,
  null
)(HeaderMenu);
