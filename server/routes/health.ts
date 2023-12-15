import { Router } from "express";
import client from "../redis";

const router = Router();

router.get("/", (_, res) => {
    const redisStatus = client.status;
    const status = redisStatus !== "connect" ? 500 : 200;
    res
    .status(status)
    .json({
        api: "OK",
        redis: client.status,
    });
});

export default router;
