const env = require("../env");
const redis = require("../redis");

class VisitCounter {
  constructor() {
    this.pipeline = redis.client.pipeline();
    this.lastFlushTime = Date.now();
  }

  async increment(linkId, data) {
    const now = new Date();
    const hour = now.getUTCHours();
    const date = now.toISOString().split('T')[0];
    
    const key = redis.key.visitStats(linkId, date);
    const visitKey = redis.key.visitDetails(linkId, date, hour);
    
    // increase the hour visit count
    await this.pipeline.hincrby(key, `h:${hour}`, 1);
    
    // record the visit details
    await this.pipeline.rpush(visitKey, JSON.stringify({
      userAgent: data.userAgent,
      ip: data.ip,
      country: data.country,
      referrer: data.referrer,
      timestamp: now.toISOString()
    }));
    
    // set the expiration time
    await this.pipeline.expire(key, env.CACHE_TTL);
    await this.pipeline.expire(visitKey, env.CACHE_TTL);
    
    // check if it needs to be flushed to the database
    if (Date.now() - this.lastFlushTime > env.FLUSH_INTERVAL) {
      await this.flush();
    }
  }

  async flush() {
    try {
      await this.pipeline.exec();
      this.lastFlushTime = Date.now();
      this.pipeline = redis.client.pipeline();
    } catch (error) {
      console.error('Failed to flush visit data:', error);
    }
  }
}

module.exports = new VisitCounter();