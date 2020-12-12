import { useState } from "react";

const initialMessage = { color: "#c61111", text: "" };

export const useMessage = (timeout?: number) => {
  const [message, set] = useState(initialMessage);

  const setMessage = (text = "", color = "#c61111") => {
    set({ text, color });

    if (timeout) {
      setTimeout(() => set(initialMessage), timeout);
    }
  };

  return [message, setMessage] as const;
};

export const useCopy = (timeout = 1500) => {
  const [copied, set] = useState(false);

  const setCopied = (isCopied = true) => {
    set(isCopied);

    if (isCopied && timeout) {
      setTimeout(() => set(false), timeout);
    }
  };

  return [copied, setCopied] as const;
};
