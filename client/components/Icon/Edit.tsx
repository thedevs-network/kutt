import React from "react";

function Edit() {
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
      <path d="M20 14.66V20a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2h5.34"></path>
      <path d="M18 2L22 6 12 16 8 16 8 12 18 2z"></path>
    </svg>
  );
}

export default React.memo(Edit);
