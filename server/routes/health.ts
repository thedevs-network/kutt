import { Router } from "express";
import client, { redisHealthStatus } from "../redis";

const router = Router();
router.get("/", (_, res) => {
    const redisStatus = client.status;
    const status = redisHealthStatus.includes(redisStatus) ? 200 : 500;
    res
    .status(status)
    .json({
        api: "OK",
        redis: client.status,
    });
});

export default router;
