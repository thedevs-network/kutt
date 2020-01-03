import React from "react";

function Zap() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      className="feather feather-zap"
      viewBox="0 0 24 24"
    >
      <path d="M13 2L3 14 12 14 11 22 21 10 12 10 13 2z"></path>
    </svg>
  );
}

export default React.memo(Zap);
