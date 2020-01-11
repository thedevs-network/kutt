import Queue from "bull";
import path from "path";

const redis = {
  port: Number(process.env.REDIS_PORT) || 6379,
  host: process.env.REDIS_HOST || "127.0.0.1",
  ...(process.env.REDIS_PASSWORD && { password: process.env.REDIS_PASSWORD })
};

const removeJob = job => job.remove();

export const visitQueue = new Queue("visit", { redis });

visitQueue.clean(5000, "completed");

visitQueue.process(4, path.resolve(__dirname, "visitQueue.js"));

visitQueue.on("completed", removeJob);
