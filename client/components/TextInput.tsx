import styled from "styled-components";
import { withProp, prop } from "styled-tools";
import { Flex, BoxProps } from "reflexbox/styled-components";

import { fadeIn } from "../helpers/animations";

interface Props extends BoxProps {
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

const TextInput = styled(Flex).attrs({
  as: "input"
})<Props>`
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
  animation: ${fadeIn} 0.5s ease-out;
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

export default TextInput;
