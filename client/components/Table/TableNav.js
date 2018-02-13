import React from 'react';
import PropTypes from 'prop-types';
import styled, { css } from 'styled-components';

const Wrapper = styled.div`
  display: flex;
  align-items: center;
`;

const Nav = styled.button`
  margin-left: 12px;
  padding: 5px 8px 3px;
  border-radius: 4px;
  border: 1px solid #eee;
  background-color: transparent;
  box-shadow: 0 0px 10px rgba(100, 100, 100, 0.1);
  transition: all 0.2s ease-out;

  ${({ active }) =>
    active &&
    css`
      background-color: white;
      cursor: pointer;
    `};

  :hover {
    ${({ active }) =>
      active &&
      css`
        transform: translateY(-2px);
        box-shadow: 0 5px 25px rgba(50, 50, 50, 0.1);
      `};
  }

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

const TableNav = ({ handleNav, next, prev }) => (
  <Wrapper>
    <Nav active={prev} data-active={prev} data-type="prev" onClick={handleNav}>
      <Icon src="/images/nav-left.svg" />
    </Nav>
    <Nav active={next} data-active={next} data-type="next" onClick={handleNav}>
      <Icon src="/images/nav-right.svg" />
    </Nav>
  </Wrapper>
);

TableNav.propTypes = {
  handleNav: PropTypes.func.isRequired,
  next: PropTypes.bool.isRequired,
  prev: PropTypes.bool.isRequired,
};

export default TableNav;
