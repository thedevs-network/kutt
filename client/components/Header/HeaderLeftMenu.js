import React from 'react';
import styled from 'styled-components';
import HeaderMenuItem from './HeaderMenuItem';

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

const HeaderLeftMenu = () => (
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
  </List>
);

export default HeaderLeftMenu;
