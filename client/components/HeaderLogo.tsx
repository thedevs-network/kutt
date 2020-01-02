import React, { FC } from "react";
import Router from "next/router";
import styled from "styled-components";

const LogoImage = styled.div`
  & > a {
    position: relative;
    display: flex;
    align-items: center;
    margin: 0 8px 0 0;
    font-size: 22px;
    font-weight: bold;
    text-decoration: none;
    color: inherit;
    transition: border-color 0.2s ease-out;
  }

  @media only screen and (max-width: 488px) {
    a {
      font-size: 18px;
    }
  }

  img {
    width: 18px;
    margin-right: 11px;
  }
`;

const HeaderLogo: FC = () => {
  const goTo = e => {
    e.preventDefault();
    const path = e.target.getAttribute("href");
    if (window.location.pathname === path) return;
    Router.push(path);
  };

  return (
    <LogoImage>
      <a href="/" title="Homepage" onClick={goTo}>
        <img src="/images/logo.svg" alt="" />
        Kutt.it
      </a>
    </LogoImage>
  );
};

export default HeaderLogo;
