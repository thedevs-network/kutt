import React from "react";

function Shuffle() {
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
      <path d="M16 3h5v5M4 20L20.2 3.8M21 16v5h-5m-1-6l5.1 5.1M4 4l5 5"></path>
    </svg>
  );
}

export default React.memo(Shuffle);
