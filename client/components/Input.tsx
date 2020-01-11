import { Flex, BoxProps } from "reflexbox/styled-components";
import styled, { css, keyframes } from "styled-components";
import { withProp, prop, ifProp } from "styled-tools";
import { FC } from "react";

import { Span } from "./Text";

interface StyledSelectProps extends BoxProps {
  autoFocus?: boolean;
  name?: string;
  id?: string;
  type?: string;
  value?: string;
  required?: boolean;
  onChange?: any;
  placeholderSize?: number[];
  br?: string;
  bbw?: string;
}

export const TextInput = styled(Flex).attrs({
  as: "input"
})<StyledSelectProps>`
  position: relative;
  box-sizing: border-box;
  letter-spacing: 0.05em;
  color: #444;
  background-color: white;
  box-shadow: 0 10px 35px hsla(200, 15%, 70%, 0.2);
  border: none;
  border-radius: ${prop("br", "100px")};
  border-bottom: 5px solid #f5f5f5;
  border-bottom-width: ${prop("bbw", "5px")};
  transition: all 0.5s ease-out;

  :focus {
    outline: none;
    box-shadow: 0 20px 35px hsla(200, 15%, 70%, 0.4);
  }

  ::placeholder {
    font-size: ${withProp("placeholderSize", s => s[0] || 14)}px;
    letter-spacing: 0.05em;
    color: #888;
  }

  @media screen and (min-width: 64em) {
    ::placeholder {
      font-size: ${withProp(
        "placeholderSize",
        s => s[3] || s[2] || s[1] || s[0] || 16
      )}px;
    }
  }

  @media screen and (min-width: 52em) {
    letter-spacing: 0.1em;
    border-bottom-width: ${prop("bbw", "6px")};
    ::placeholder {
      font-size: ${withProp(
        "placeholderSize",
        s => s[2] || s[1] || s[0] || 15
      )}px;
    }
  }

  @media screen and (min-width: 40em) {
    ::placeholder {
      font-size: ${withProp("placeholderSize", s => s[1] || s[0] || 15)}px;
    }
  }
`;

TextInput.defaultProps = {
  value: "",
  height: [40, 44],
  py: 0,
  px: [3, 24],
  fontSize: [14, 15],
  placeholderSize: [13, 14]
};

interface StyledSelectProps extends BoxProps {
  name?: string;
  id?: string;
  type?: string;
  value?: string;
  required?: boolean;
  onChange?: any;
  br?: string;
  bbw?: string;
}

interface SelectOptions extends StyledSelectProps {
  options: Array<{ key: string; value: string | number }>;
}

const StyledSelect: FC<StyledSelectProps> = styled(Flex).attrs({
  as: "select"
})<StyledSelectProps>`
  position: relative;
  box-sizing: border-box;
  letter-spacing: 0.05em;
  color: #444;
  background-color: white;
  box-shadow: 0 10px 35px hsla(200, 15%, 70%, 0.2);
  border: none;
  border-radius: ${prop("br", "100px")};
  border-bottom: 5px solid #f5f5f5;
  border-bottom-width: ${prop("bbw", "5px")};
  transition: all 0.5s ease-out;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 24 24' fill='none' stroke='%235c666b' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat, repeat;
  background-position: right 1.2em top 50%, 0 0;
  background-size: 1em auto, 100%;

  :focus {
    outline: none;
    box-shadow: 0 20px 35px hsla(200, 15%, 70%, 0.4);
  }

  @media screen and (min-width: 52em) {
    letter-spacing: 0.1em;
    border-bottom-width: ${prop("bbw", "6px")};
  }
`;

export const Select: FC<SelectOptions> = ({ options, ...props }) => (
  <StyledSelect {...props}>
    {options.map(({ key, value }) => (
      <option key={value} value={value}>
        {key}
      </option>
    ))}
  </StyledSelect>
);

Select.defaultProps = {
  value: "",
  height: [40, 44],
  py: 0,
  px: [3, 24],
  fontSize: [14, 15]
};

interface ChecknoxInputProps {
  checked: boolean;
  id?: string;
  name: string;
  onChange: any;
}

const CheckboxInput = styled(Flex).attrs({
  as: "input",
  type: "checkbox",
  m: 0,
  p: 0,
  width: 0,
  height: 0,
  opacity: 0
})<ChecknoxInputProps>`
  position: relative;
  opacity: 0;
`;

const CheckboxBox = styled(Flex).attrs({
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
        animation: ${keyframes`
          from {
            opacity: 0;
            transform: scale(0, 0);
          }
          to {
            opacity: 1;
            transform: scale(1, 1);
          }
        `} 0.1s ease-in;
      }
    `
  )}
`;

interface CheckboxProps extends ChecknoxInputProps, BoxProps {
  label: string;
}

export const Checkbox: FC<CheckboxProps> = ({
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
      <CheckboxInput
        onChange={onChange}
        name={name}
        id={id}
        checked={checked}
      />
      <CheckboxBox checked={checked} width={width} height={height} />
      <Span ml={[10, 12]} mt="1px" color="#555">
        {label}
      </Span>
    </Flex>
  );
};

Checkbox.defaultProps = {
  width: [16, 18],
  height: [16, 18],
  fontSize: [15, 16]
};
