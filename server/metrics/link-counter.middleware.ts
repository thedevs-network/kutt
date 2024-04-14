import { Handler, NextFunction, Request, Response } from "express";
import { Counter } from "prom-client";
import { register } from "../routes/metrics";

const linkCounter = new Counter({
  name: 'link_counter',
  help: 'Number of links created',
  registers: [register]
})

export const linkCounterMiddleware: Handler = (
  _req: Request, res: Response, next: NextFunction,
) => {
  res.on("close", () => {
    if ([200, 201].includes(res.statusCode)) {
      linkCounter.inc(1);
    }
  })
  next();
}
