const request = require('supertest');
const app = require('../server/app'); // ajuste le chemin selon ton projet
const db = require('../server/knex'); // ajuste le chemin selon ton projet

beforeAll(() => {
  // Évite les messages d'erreur SQLite dans la sortie console des tests
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

let consoleErrorSpy: jest.SpyInstance;

beforeAll(() => {
  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
  consoleErrorSpy.mockRestore();
});

afterAll(async () => {
  // Ferme la connexion à la base de données après tous les tests
  await db.destroy(); // Assurez-vous que cette méthode existe dans votre module db
});


describe('Health Check', () => {
  it('should run a basic sanity test', () => {
    expect(1 + 1).toBe(2);
  });
});

describe('Root route', () => {
  it('should return 200 or redirect from /', async () => {
    const res = await request(app).get('/');
    expect([200, 302]).toContain(res.statusCode);
  });

  it('should follow redirection and return 200 if applicable', async () => {
    const res = await request(app).get('/').redirects(1);
    expect(res.statusCode).toBe(200);
  });
});

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

describe('Short link redirect', () => {
  it('should redirect or 404 on /:id', async () => {
    const res = await request(app).get('/test123');
    expect([301, 302, 404]).toContain(res.statusCode);
  });
});

describe('Helmet headers', () => {
  it('should include helmet security headers', async () => {
    const res = await request(app).get('/');
    expect(res.headers['x-dns-prefetch-control']).toBe('off');
    expect(res.headers['x-frame-options']).toBeDefined();
    expect(res.headers['x-content-type-options']).toBeDefined();
  });
});

describe('Protected endpoints (unauthenticated)', () => {
  it('should return 200 on GET /api/url even without token', async () => {
    const res = await request(app).get('/api/url');
    expect(res.statusCode).toBe(200);
  });  
});