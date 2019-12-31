import { useState } from "react";

const initialMessage = { color: "red", text: "" };

export const useMessage = (timeout?: number) => {
  const [message, set] = useState(initialMessage);

  const setMessage = (text = "", color = "red") => {
    set({ text, color });

    if (timeout) {
      setTimeout(() => set(initialMessage), timeout);
    }
  };

  return [message, setMessage] as const;
};
