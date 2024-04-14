import asyncHandler from "express-async-handler";
import client from 'prom-client'
import { Router } from "express";

const router = Router();

export const register = new client.Registry();

client.collectDefaultMetrics({
  register,
});

router.get(
  "/",
  asyncHandler(async (_, res) => {
    res.set("Content-Type", register.contentType);
    return res.send(await register.metrics());
  })
);

export default router;
