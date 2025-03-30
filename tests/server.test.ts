const request = require('supertest');
const app = require('../server/app');

describe('Health Check', () => {
    it('should run a basic test', () => {
      expect(1 + 1).toBe(2);
    });
  });
  
//   describe('Root route', () => {
//     it('should return 200 or redirect from /', async () => {
//       const res = await request(app).get('/');
//       expect([200, 302]).toContain(res.statusCode);
//     });
  
//     it('should follow redirection and return 200 if applicable', async () => {
//       const res = await request(app).get('/').redirects(1);
//       expect(res.statusCode).toBe(200);
//     });
//   });
  
  describe('Static routes', () => {
    it('should not crash on /css/style.css', async () => {
      const res = await request(app).get('/css/style.css');
      expect([200, 403, 404]).toContain(res.statusCode);
    });
  });
  
  describe('API routes', () => {
    it('should not return 404 on /api', async () => {
      const res = await request(app).get('/api');
      expect(res.statusCode).not.toBe(404);
    });
  
    it('should not return 404 on /api/v2', async () => {
      const res = await request(app).get('/api/v2');
      expect(res.statusCode).not.toBe(404);
    });
  });
  
//   describe('Short link redirect', () => {
//     it('should redirect or 404 on /:id', async () => {
//       const res = await request(app).get('/test123');
//       expect([301, 302, 404]).toContain(res.statusCode);
//     });
//   });
  
  describe('Helmet headers', () => {
    it('should include helmet security headers', async () => {
      const res = await request(app).get('/');
      expect(res.headers['x-dns-prefetch-control']).toBe('off');
      expect(res.headers['x-frame-options']).toBeDefined();
      expect(res.headers['x-content-type-options']).toBeDefined();
    });
  });
