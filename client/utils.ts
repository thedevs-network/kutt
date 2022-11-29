import cookie from "js-cookie";
import { AxiosRequestConfig, AxiosError } from "axios";

export const removeProtocol = (link: string) =>
  link.replace(/^https?:\/\//, "");

export const withComma = (num: number) =>
  num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

export const getAxiosConfig = (
  options: AxiosRequestConfig = {}
): AxiosRequestConfig => ({
  ...options,
  headers: {
    ...options.headers,
    Authorization: cookie.get("token")
  }
});

export const errorMessage = (err: AxiosError, defaultMessage?: string) => {
  const data = err?.response?.data as Record<string, any>;
  return data?.message || data?.error || defaultMessage || "";
};
