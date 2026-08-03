import { jest } from '@jest/globals';
import { sanitizeRequest } from '../middleware/sanitize.js';

const runSanitizer = (req) => {
  const next = jest.fn();
  sanitizeRequest(req, {}, next);
  return next;
};

describe('sanitizeRequest', () => {
  it('strips Mongo operator keys from the body', () => {
    const req = { body: { email: { $ne: null }, password: 'x' }, originalUrl: '/api/auth/login', method: 'POST' };

    runSanitizer(req);

    expect(req.body.email).toEqual({});
    expect(req.body.password).toBe('x');
  });

  it('strips dotted keys that could reach into nested paths', () => {
    const req = { body: { 'user.role': 'Admin', name: 'Aayush' }, originalUrl: '/x', method: 'PUT' };

    runSanitizer(req);

    expect(req.body['user.role']).toBeUndefined();
    expect(req.body.name).toBe('Aayush');
  });

  it('recurses into nested objects and arrays', () => {
    const req = {
      body: { filters: [{ $where: 'evil' }, { status: 'Todo' }], nested: { deep: { $gt: 1, ok: 2 } } },
      originalUrl: '/x',
      method: 'POST',
    };

    runSanitizer(req);

    expect(req.body.filters[0]).toEqual({});
    expect(req.body.filters[1]).toEqual({ status: 'Todo' });
    expect(req.body.nested.deep).toEqual({ ok: 2 });
  });

  it('mutates req.query in place rather than reassigning it', () => {
    // Express 5 exposes req.query as a getter-only property; reassigning throws.
    const query = { organizationId: { $ne: null }, page: '2' };
    const req = { originalUrl: '/x', method: 'GET' };
    Object.defineProperty(req, 'query', { get: () => query });

    expect(() => runSanitizer(req)).not.toThrow();
    expect(req.query.organizationId).toEqual({});
    expect(req.query.page).toBe('2');
  });

  it('leaves clean payloads untouched and calls next', () => {
    const req = { body: { title: 'Standup', tags: ['a', 'b'] }, originalUrl: '/x', method: 'POST' };

    const next = runSanitizer(req);

    expect(req.body).toEqual({ title: 'Standup', tags: ['a', 'b'] });
    expect(next).toHaveBeenCalledTimes(1);
  });
});
