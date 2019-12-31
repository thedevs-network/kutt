import React from "react";

function ChevronRight() {
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
      className="feather feather-chevron-right"
      viewBox="0 0 24 24"
    >
      <path d="M9 18L15 12 9 6"></path>
    </svg>
  );
}

export default React.memo(ChevronRight);
