import { validate } from '../middleware/validate.js';
import { createTaskSchema } from '../validators/schemas.js';
import { jest } from '@jest/globals';

describe('Task Validation Middleware', () => {
  it('should pass validation with valid task body', () => {
    const req = {
      body: {
        title: 'Complete documentation',
        status: 'Todo',
        priority: 'high',
        meetingId: null,
        organizationId: null,
        teamId: null,
        assignee: null
      }
    };
    const res = {};
    const next = jest.fn();

    const middleware = validate(createTaskSchema);
    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(); // called without arguments meaning success
  });

  it('should fail validation without a title and return 400', () => {
    const req = {
      body: {
        description: 'Missing title test'
      }
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    const next = jest.fn();

    const middleware = validate(createTaskSchema);
    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalled();
    const jsonResponse = res.json.mock.calls[0][0];
    expect(jsonResponse.message).toBe('Validation failed');
    expect(Array.isArray(jsonResponse.errors)).toBe(true);
    expect(jsonResponse.errors[0].field).toBe('title');
  });
});
