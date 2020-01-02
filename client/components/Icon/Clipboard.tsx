import React from "react";

function Clipboard() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="auto"
      height="auto"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      className="feather feather-clipboard"
      viewBox="0 0 24 24"
    >
      <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"></path>
      <rect width="8" height="4" x="8" y="2" rx="1" ry="1"></rect>
    </svg>
  );
}

export default React.memo(Clipboard);
