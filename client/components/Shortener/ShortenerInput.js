import React from 'react';
import PropTypes from 'prop-types';
import styled from 'styled-components';
import SVG from 'react-inlinesvg';
import ShortenerOptions from './ShortenerOptions';
import TextInput from '../TextInput';
import Error from '../Error';

const ShortenerForm = styled.form`
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 800px;
  max-width: 100%;
`;

const Submit = styled.div`
  content: '';
  position: absolute;
  top: 0;
  right: 12px;
  width: 64px;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;

  :hover svg {
    fill: #673ab7;
  }
  @media only screen and (max-width: 448px) {
    right: 8px;
    width: 40px;
  }
`;

const Icon = styled(SVG)`
  svg {
    width: 28px;
    height: 28px;
    margin-right: 8px;
    margin-top: 2px;
    fill: #aaa;
    transition: all 0.2s ease-out;

    @media only screen and (max-width: 448px) {
      height: 22px;
      width: 22px;
    }
  }
`;

const ShortenerInput = ({ isAuthenticated, handleSubmit, setShortenerFormError }) => (
  <ShortenerForm id="shortenerform" onSubmit={handleSubmit}>
    <TextInput id="target" name="target" placeholder="Paste your long URL" autoFocus />
    <Submit onClick={handleSubmit}>
      <Icon src="/images/send.svg" />
    </Submit>
    <Error type="shortener" />
    <ShortenerOptions
      isAuthenticated={isAuthenticated}
      setShortenerFormError={setShortenerFormError}
    />
  </ShortenerForm>
);

ShortenerInput.propTypes = {
  handleSubmit: PropTypes.func.isRequired,
  isAuthenticated: PropTypes.bool.isRequired,
  setShortenerFormError: PropTypes.func.isRequired,
};

export default ShortenerInput;
