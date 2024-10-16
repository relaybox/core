import { vi } from 'vitest';

export const mockQueue = {
  add: vi.fn(),
  getJob: vi.fn(),
  on: vi.fn()
};

vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => mockQueue)
}));
