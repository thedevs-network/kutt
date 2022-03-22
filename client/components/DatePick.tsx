/*
React Date Picker
npmjs.com/package/react-datepicker
v4.7.0

More options available at https://www.reactdatepicker.com
*/

import React, { FC, useState, useEffect } from "react";
import styled, { css } from "styled-components";
import DatePicker from "react-datepicker";

const DatePick = styled(DatePicker)`
  position: relative;
  box-sizing: border-box;
  letter-spacing: 0.05em;
  color: #444;
  background-color: white;
  box-shadow: 0 10px 35px hsla(200, 15%, 70%, 0.2);
  border: none;
  border-radius: 100px;
  border-bottom: 5px solid #f5f5f5;
  border-bottom-width: 5px;
  transition: all 0.5s ease-out;
  width: 100%;
  height: 44px;
  padding-left: 24px;
  padding-right: 24px;
  font-size: 15px;

  :focus {
    outline: none;
    box-shadow: 0 20px 35px hsla(200, 15%, 70%, 0.4);
  }

  @media screen and (min-width: 52em) {
    letter-spacing: 0.1em;
    border-bottom-width: 6px;
  }
`;

export default DatePick;
