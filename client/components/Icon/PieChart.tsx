import React from "react";

function Icon() {
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
      <path d="M21.21 15.89A10 10 0 118 2.83M22 12A10 10 0 0012 2v10z"></path>
    </svg>
  );
}

export default React.memo(Icon);
