import React, { FC } from "react";
import styled, { css } from "styled-components";
import { ifProp } from "styled-tools";
import { Flex, BoxProps } from "reflexbox/styled-components";

import { Span } from "./Text";

interface InputProps {
  checked: boolean;
  id?: string;
  name: string;
  onChange: any;
}

const Input = styled(Flex).attrs({
  as: "input",
  type: "checkbox",
  m: 0,
  p: 0,
  width: 0,
  height: 0,
  opacity: 0
})<InputProps>`
  position: relative;
  opacity: 0;
`;

const Box = styled(Flex).attrs({
  alignItems: "center",
  justifyContent: "center"
})<{ checked: boolean }>`
  position: relative;
  transition: color 0.3s ease-out;
  border-radius: 4px;
  background-color: white;
  box-shadow: 0 2px 4px rgba(50, 50, 50, 0.2);
  cursor: pointer;

  input:focus + & {
    outline: 3px solid rgba(65, 164, 245, 0.5);
  }

  ${ifProp(
    "checked",
    css`
      box-shadow: 0 3px 5px rgba(50, 50, 50, 0.4);

      :after {
        content: "";
        position: absolute;
        width: 80%;
        height: 80%;
        display: block;
        border-radius: 2px;
        background-color: #9575cd;
        box-shadow: 0 2px 4px rgba(50, 50, 50, 0.2);
        cursor: pointer;
      }
    `
  )}
`;

interface Props extends InputProps, BoxProps {
  label: string;
}

const Checkbox: FC<Props> = ({
  checked,
  height,
  id,
  label,
  name,
  width,
  onChange,
  ...rest
}) => {
  return (
    <Flex
      flex="0 0 auto"
      as="label"
      alignItems="center"
      style={{ cursor: "pointer" }}
      {...(rest as any)}
    >
      <Input onChange={onChange} name={name} id={id} checked={checked} />
      <Box checked={checked} width={width} height={height} />
      <Span ml={12} color="#555">
        {label}
      </Span>
    </Flex>
  );
};

Checkbox.defaultProps = {
  width: [18],
  height: [18]
};

export default Checkbox;
