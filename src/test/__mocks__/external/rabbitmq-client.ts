import { vi } from 'vitest';

export const mockRabbitMQConnection = {
  on: vi.fn(),
  acquire: vi.fn().mockResolvedValue({
    on: vi.fn(),
    queueBind: vi.fn(),
    queueUnbind: vi.fn()
  })
};

vi.mock('rabbitmq-client', () => ({
  Connection: vi.fn().mockImplementation(() => mockRabbitMQConnection)
}));
