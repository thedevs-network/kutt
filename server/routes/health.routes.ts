import { Router } from "express";

const router = Router();

router.get("/", (_, res) => res.send("OK"));

export default router;
