import { sanitizeBody, CustomSanitizer } from "express-validator";
import { addProtocol } from "../utils";

const passIfUser: CustomSanitizer = (value, { req }) =>
  req.user ? value : undefined;

export const createLink = [
  sanitizeBody("target")
    .trim()
    .customSanitizer(value => value && addProtocol(value)),
  sanitizeBody("domain")
    .customSanitizer(value =>
      typeof value === "string" ? value.toLowerCase() : undefined
    )
    .customSanitizer(passIfUser),
  sanitizeBody("password").customSanitizer(passIfUser),
  sanitizeBody("customurl")
    .customSanitizer(passIfUser)
    .customSanitizer(value => value && value.trim()),
  sanitizeBody("reuse").customSanitizer(passIfUser)
];
