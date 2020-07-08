import { Request } from "express";

export interface CreateLinkReq extends Request {
  body: {
    reuse?: boolean;
    password?: string;
    customurl?: string;
    description?: string;
    isSearchable?: boolean;
    domain?: Domain;
    target: string;
  };
}
