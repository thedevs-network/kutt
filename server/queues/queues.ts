import Queue from "bull";
import path from "path";

import env from "../env";

const redis = {
  port: env.REDIS_PORT,
  host: env.REDIS_HOST,
  ...(env.REDIS_PASSWORD && { password: env.REDIS_PASSWORD })
};

const removeJob = job => job.remove();

export const visit = new Queue("visit", { redis });

visit.clean(5000, "completed");

visit.process(8, path.resolve(__dirname, "visit.js"));

visit.on("completed", removeJob);
