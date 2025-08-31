import 'jest-extended';

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';
process.env.DATABASE_URL = 'mysql://test:test@localhost:3306/test_db';
process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.EMAIL_USER = 'test@example.com';
process.env.EMAIL_PASS = 'test-password';

// Global test timeout
jest.setTimeout(30000);

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
