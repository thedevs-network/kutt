import React, { FC } from 'react';
import styled, { css } from 'styled-components';
import { ifProp } from 'styled-tools';
import { Flex } from 'reflexbox/styled-components';

interface Props {
  handleNav: any; // TODO: types
  next: boolean;
  prev: boolean;
}

const Nav = styled.button<{ disabled: boolean }>`
  margin-left: 12px;
  padding: 5px 8px 3px;
  border-radius: 4px;
  border: 1px solid #eee;
  background-color: transparent;
  box-shadow: 0 0px 10px rgba(100, 100, 100, 0.1);
  transition: all 0.2s ease-out;

  ${ifProp(
    'disabled',
    css`
      background-color: white;
      cursor: pointer;
    `
  )}

  ${ifProp(
    { disabled: false },
    css`
      :hover {
        transform: translateY(-2px);
        box-shadow: 0 5px 25px rgba(50, 50, 50, 0.1);
      }
    `
  )}

  @media only screen and (max-width: 768px) {
    padding: 4px 6px 2px;
  }
`;

const Icon = styled.img`
  width: 14px;
  height: 14px;

  @media only screen and (max-width: 768px) {
    width: 12px;
    height: 12px;
  }
`;

const TableNav: FC<Props> = ({ handleNav, next, prev }) => (
  <Flex alignItems="center">
    <Nav disabled={!prev} onClick={handleNav(-1)}>
      <Icon src="/images/nav-left.svg" />
    </Nav>
    <Nav disabled={!next} onClick={handleNav(1)}>
      <Icon src="/images/nav-right.svg" />
    </Nav>
  </Flex>
);

export default TableNav;
