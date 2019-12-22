import React, { FC } from "react";
import { bindActionCreators } from "redux";
import { connect } from "react-redux";
import styled from "styled-components";
import Router from "next/router";

import HeaderMenuItem from "./HeaderMenuItem";

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

const HeaderLeftMenu: FC = () => {
  const goTo = e => {
    e.preventDefault();
    const path = e.currentTarget.getAttribute("href");
    if (!path || window.location.pathname === path) return;
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

export default HeaderLeftMenu;
