import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock environment variables
Object.defineProperty(import.meta.env, 'VITE_API_BASE_URL', {
  value: 'http://localhost:9000',
  writable: true,
});
Object.defineProperty(import.meta.env, 'VITE_WS_URL', {
  value: 'ws://localhost:9000',
  writable: true,
});

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};
global.localStorage = localStorageMock;

// Mock WebSocket
global.WebSocket = vi.fn().mockImplementation(() => ({
  send: vi.fn(),
  close: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
}));

// Mock fetch
global.fetch = vi.fn();

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));
