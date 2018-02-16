import React, { Component } from 'react';
import PropTypes from 'prop-types';
import styled from 'styled-components';
import Checkbox from '../Checkbox';
import TextInput from '../TextInput';
import { fadeIn } from '../../helpers/animations';

const Wrapper = styled.div`
  position: absolute;
  top: 74px;
  left: 0;
  display: flex;
  flex-direction: column;
  align-self: flex-start;
  justify-content: flex-start;
  z-index: 2;

  @media only screen and (max-width: 448px) {
    top: 56px;
  }
`;

const CheckboxWrapper = styled.div`
  display: flex;
`;

const InputWrapper = styled.div`
  display: flex;
  align-items: center;

  @media only screen and (max-width: 448px) {
    flex-direction: column;
    align-items: flex-start;

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

class ShortenerOptions extends Component {
  constructor() {
    super();
    this.state = {
      customurlCheckbox: false,
      passwordCheckbox: false,
    };
    this.handleCheckbox = this.handleCheckbox.bind(this);
  }

  shouldComponentUpdate(nextProps, nextState) {
    const { customurlCheckbox, passwordCheckbox } = this.state;
    return (
      this.props.isAuthenticated !== nextProps.isAuthenticated ||
      customurlCheckbox !== nextState.customurlCheckbox ||
      passwordCheckbox !== nextState.passwordCheckbox
    );
  }

  handleCheckbox(e) {
    e.preventDefault();
    if (!this.props.isAuthenticated) {
      return this.props.setShortenerFormError('Please login or sign up to use this feature.');
    }
    const type = e.target.id;
    return this.setState({ [type]: !this.state[type] });
  }

  render() {
    const { customurlCheckbox, passwordCheckbox } = this.state;
    const { isAuthenticated } = this.props;
    const customUrlInput = customurlCheckbox && (
      <div>
        <Label htmlFor="customurl">{window.location.hostname}/</Label>
        <TextInput id="customurl" type="text" placeholder="custom name" small />
      </div>
    );
    const passwordInput = passwordCheckbox && (
      <div>
        <Label htmlFor="customurl">password:</Label>
        <TextInput id="password" type="password" placeholder="password" small />
      </div>
    );
    return (
      <Wrapper isAuthenticated={isAuthenticated}>
        <CheckboxWrapper>
          <Checkbox
            id="customurlCheckbox"
            name="customurlCheckbox"
            label="Set custom URL"
            checked={this.state.customurlCheckbox}
            onClick={this.handleCheckbox}
          />
          <Checkbox
            id="passwordCheckbox"
            name="passwordCheckbox"
            label="Set password"
            checked={this.state.passwordCheckbox}
            onClick={this.handleCheckbox}
          />
        </CheckboxWrapper>
        <InputWrapper>
          {customUrlInput}
          {passwordInput}
        </InputWrapper>
      </Wrapper>
    );
  }
}

ShortenerOptions.propTypes = {
  isAuthenticated: PropTypes.bool.isRequired,
  setShortenerFormError: PropTypes.func.isRequired,
};

export default ShortenerOptions;
