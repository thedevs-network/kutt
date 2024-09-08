const Queue = require("bull");
const path = require("path");

const env = require("../env");

const redis = {
  port: env.REDIS_PORT,
  host: env.REDIS_HOST,
  ...(env.REDIS_PASSWORD && { password: env.REDIS_PASSWORD })
};

function onComplete(job) { 
  console.log('complete');
  return job.remove();
}

const visit = new Queue("visit", { redis });

const a = require(__dirname + "/visit.js");
// visit.clean(5000, "completed");
visit.process(__dirname + "/visit.js");
visit.on("completed", onComplete);

visit.on('error', function (error) {
  console.log('error');
})

visit.on('waiting', function (jobId) {
  console.log('waiting');
});

visit.on('active', function (job, jobPromise) {
  console.log('active');
})

visit.on('stalled', function (job) {
  console.log('stalled');
})

visit.on('lock-extension-failed', function (job, err) {
  console.log('lock-extension-failed');
});

visit.on('progress', function (job, progress) {
  console.log('progress');
})

visit.on('failed', function (job, err) {
  console.log(err);
  console.log('failed');
})

visit.on('paused', function () {
  console.log('paused');
})

visit.on('resumed', function (job) {
  console.log('resumed');
})

visit.on('cleaned', function (jobs, type) {
  console.log('cleaned');
});

visit.on('drained', function () {
  console.log('drained');
});

visit.on('removed', function (job) {
  console.log('removed');
});

module.exports = { 
  visit,
}