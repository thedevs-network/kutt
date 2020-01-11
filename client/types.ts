export interface TokenPayload {
  iss: "ApiAuth";
  sub: string;
  domain: string;
  admin: boolean;
  iat: number;
  exp: number;
}
