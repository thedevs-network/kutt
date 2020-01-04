import React, { FC } from "react";
import styled from "styled-components";
import { Flex } from "reflexbox/styled-components";

import { fadeIn } from "../helpers/animations";
import Icon from "./Icon";
import { Icons } from "./Icon/Icon";

interface Props {
  title: string;
  icon: Icons;
}

const Block = styled(Flex).attrs({
  maxWidth: ["100%", "100%", "50%", "25%"],
  flexDirection: "column",
  alignItems: "center",
  p: "0 24px",
  mb: [48, 48, 48, 0]
})`
  animation: ${fadeIn} 0.8s ease-out;

  :last-child {
    margin-right: 0;
  }
`;

const IconBox = styled(Flex).attrs({
  width: [40, 40, 48],
  height: [40, 40, 48],
  alignItems: "center",
  justifyContent: "center"
})`
  border-radius: 100%;
  box-sizing: border-box;
  background-color: #2196f3;
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

const FeaturesItem: FC<Props> = ({ children, icon, title }) => (
  <Block>
    <IconBox>
      <Icon name={icon} stroke="white" strokeWidth="2" />
    </IconBox>
    <Title>{title}</Title>
    <Description>{children}</Description>
  </Block>
);

export default FeaturesItem;
