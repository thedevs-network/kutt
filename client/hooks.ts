import { useState, useContext, useEffect} from "react";
import { ThemeContext } from "styled-components";

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


export const useTheme = () => {
  const theme = useContext(ThemeContext) 
  return theme;
}
export const useWindowEvent = (name, callback) => {
  useEffect(() => {
    window.addEventListener(name, callback);
    return () => {
      window.removeEventListener(name, callback);
    };
  }, [callback]);
} 
