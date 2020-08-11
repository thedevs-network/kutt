import React from "react";

function Eye() {
  return (
    <svg
    xmlns="http://www.w3.org/2000/svg"
    width="80"
    height="80"
    fill="none"
    stroke="#000"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="2"
      viewBox="-1 49 384.9 231.9"
    >
    <path fill="currentColor" d="M200 150c0 27.6-22.4 50-50 50 0 27.6 22.4 50 50 50s50-22.4 50-50S227.6 150 200 150zM200 50C97.45 50 0 166.2 0 200s97.45 150 200 150 200-116.2 200-150S302.55 50 200 50zM200 300c-55.225 0-100-44.775-100-100s44.775-100 100-100 100 44.775 100 100S255.225 300 200 300z
      "/>
      </svg>
  );
}


export default React.memo(Eye);
