declare namespace Express {
  interface Request {
    realIP?: string;
    pageType?: string;
    linkTarget?: string;
    protectedLink?: string;
  }
}
