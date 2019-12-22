import cookie from "js-cookie";
import { AxiosRequestConfig } from "axios";

export const getAxiosConfig = (
  options: AxiosRequestConfig = {}
): AxiosRequestConfig => ({
  ...options,
  headers: {
    ...options.headers,
    Authorization: cookie.get("token")
  }
});
