import React, { FC, useState } from "react";
import styled from "styled-components";
import { Flex } from "reflexbox/styled-components";

// import Checkbox from "../Checkbox";
import TextInput from "../TextInput";
import { fadeIn } from "../../helpers/animations";

interface Props {
  isAuthenticated: boolean;
  domain: string;
  setShortenerFormError: any; // TODO: types
}

const Wrapper = styled(Flex).attrs({
  flexDirection: "column",
  alignSelf: "flex-start",
  justifyContent: "flex-start"
})`
  position: absolute;
  top: 74px;
  left: 0;
  z-index: 2;

  @media only screen and (max-width: 448px) {
    width: 100%;
    top: 56px;
  }
`;

const InputWrapper = styled(Flex).attrs({
  flexDirection: ["column", "row"],
  alignItems: ["flex-start", "center"]
})`
  @media only screen and (max-width: 448px) {
    > * {
      margin-bottom: 16px;
    }
  }
`;

const Label = styled.label`
  font-size: 18px;
  margin-right: 16px;
  animation: ${fadeIn} 0.5s ease-out;

  @media only screen and (max-width: 448px) {
    font-size: 14px;
    margin-right: 8px;
  }
`;

const ShortenerOptions: FC<Props> = props => {
  const [customurl, setCustomurl] = useState();
  const [password, setPassword] = useState();

  const checkAuth = () => {
    if (!props.isAuthenticated) {
      props.setShortenerFormError(
        "Please login or sign up to use this feature."
      );
      return false;
    }
    return true;
  };

  const handleCustomUrl = e => {
    if (!checkAuth()) return;
    setCustomurl(e.target.value);
  };

  const handlePassword = e => {
    if (!checkAuth()) return;
    setPassword(e.target.value);
  };

  const customUrlInput = customurl && (
    <div>
      <Label htmlFor="customurl">
        {props.domain || window.location.hostname}/
      </Label>
      <TextInput id="customurl" type="text" placeholder="custom name" small />
    </div>
  );
  const passwordInput = password && (
    <div>
      <Label htmlFor="customurl">password:</Label>
      <TextInput id="password" type="password" placeholder="password" small />
    </div>
  );
  return (
    <Wrapper>
      <Flex justifyContent={["center", "flex-start"]}>
        {/* <Checkbox
          id="customurlCheckbox"
          name="customurlCheckbox"
          label="Set custom URL"
          checked={customurl}
          onClick={handleCustomUrl}
        />
        <Checkbox
          id="passwordCheckbox"
          name="passwordCheckbox"
          label="Set password"
          checked={password}
          onClick={handlePassword}
        /> */}
      </Flex>
      <InputWrapper>
        {customUrlInput}
        {passwordInput}
      </InputWrapper>
    </Wrapper>
  );
};

// TODO: see if needed
// shouldComponentUpdate(nextProps, nextState) {
//   const { customurlCheckbox, passwordCheckbox } = state;
//   return (
//     props.isAuthenticated !== nextProps.isAuthenticated ||
//     customurlCheckbox !== nextState.customurlCheckbox ||
//     props.domain !== nextProps.domain ||
//     passwordCheckbox !== nextState.passwordCheckbox
//   );
// }

export default ShortenerOptions;
