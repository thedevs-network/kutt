import React from 'react';
import PropTypes from 'prop-types';
import styled from 'styled-components';
import { fadeIn } from '../../helpers/animations';

const Block = styled.div`
  max-width: 25%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 24px;
  animation: ${fadeIn} 0.8s ease-out;

  :last-child {
    margin-right: 0;
  }

  @media only screen and (max-width: 1200px) {
    margin-bottom: 48px;
  }

  @media only screen and (max-width: 980px) {
    max-width: 50%;
  }

  @media only screen and (max-width: 760px) {
    max-width: 100%;
  }
`;

const IconBox = styled.div`
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 100%;
  box-sizing: border-box;
  background-color: #2196f3;

  @media only screen and (max-width: 448px) {
    width: 40px;
    height: 40px;
  }
`;

const Icon = styled.img`
  display: inline-block;
  width: 16px;
  height: 16px;
  margin: 0;
  padding: 0;

  @media only screen and (max-width: 448px) {
    width: 14px;
    height: 14px;
  }
`;

const Title = styled.h3`
  margin: 16px;
  font-size: 15px;

  @media only screen and (max-width: 448px) {
    margin: 12px;
    font-size: 14px;
  }
`;

const Description = styled.p`
  margin: 0;
  font-size: 14px;
  font-weight: 300;
  text-align: center;

  @media only screen and (max-width: 448px) {
    font-size: 13px;
  }
`;

const FeaturesItem = ({ children, icon, title }) => (
  <Block>
    <IconBox>
      <Icon src={`/images/${icon}.svg`} />
    </IconBox>
    <Title>{title}</Title>
    <Description>{children}</Description>
  </Block>
);

FeaturesItem.propTypes = {
  children: PropTypes.node.isRequired,
  icon: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
};

export default FeaturesItem;
