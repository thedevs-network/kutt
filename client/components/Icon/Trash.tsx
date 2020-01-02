import React from "react";

function Trash() {
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
      className="feather feather-trash-2"
      viewBox="0 0 24 24"
    >
      <path d="M3 6L5 6 21 6"></path>
      <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path>
      <path d="M10 11L10 17"></path>
      <path d="M14 11L14 17"></path>
    </svg>
  );
}

export default React.memo(Trash);
