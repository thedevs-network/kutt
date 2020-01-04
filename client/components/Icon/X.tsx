import React from "react";

function X() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="48"
      height="48"
      fill="none"
      stroke="#000"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M18 6L6 18"></path>
      <path d="M6 6L18 18"></path>
    </svg>
  );
}

export default React.memo(X);
