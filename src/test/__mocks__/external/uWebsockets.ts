import { TemplatedApp } from 'uWebSockets.js';
import { vi } from 'vitest';

export const mockApp = {
  publish: vi.fn(),
  numSubscribers: vi.fn().mockReturnValue(1)
} as unknown as TemplatedApp;
