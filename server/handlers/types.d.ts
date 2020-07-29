import { Request } from "express";

export interface CreateLinkReq extends Request {
  body: {
    reuse?: boolean;
    password?: string;
    customurl?: string;
    description?: string;
    searchable?: boolean;
    domain?: Domain;
    target: string;
  };
}
