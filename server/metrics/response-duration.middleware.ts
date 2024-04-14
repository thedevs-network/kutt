import { Handler, Request, Response } from "express";
import { Histogram, } from "prom-client";
import { register } from "../routes/metrics";

const responseDurationHistogram: Histogram = new Histogram({
  name: 'response_duration',
  help: 'response_duration',
  labelNames: ["method", "path", "status"],
  registers: [register]
});

export const responseDurationMiddleware: Handler = (
  req: Request, res: Response, next
) => {
  const { method, originalUrl } = req;

  const endTimer = responseDurationHistogram.startTimer({
    method,
    path: originalUrl
  })
  
  res.on("close", () => {
    const { statusCode } = res;
    endTimer({ status: statusCode });
  });

  next();
};