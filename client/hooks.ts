import { useState } from "react";

export const useMessage = (timeout?: number) => {
  const [message, set] = useState({ color: "red", text: "" });

  const setMessage = (text = "", color = "red") => {
    set({ text, color });

    if (timeout) {
      setTimeout(setMessage, timeout);
    }
  };

  return [message, setMessage] as const;
};
