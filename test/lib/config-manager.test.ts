import ConfigManager, { AMQP_DEFAULT_EXCHANGE_NAME, ExchangeType } from '@/lib/config-manager';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('config-manager', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeAll(() => {
    originalEnv = {
      ...process.env
    };

    process.env.STRING = 'test';
    process.env.NUMBER = '123';
    process.env.BOOLEAN = 'true';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('values', () => {
    it('should return static application values', () => {
      expect(ConfigManager.AMQP_DEFAULT_EXCHANGE_NAME).toBe(AMQP_DEFAULT_EXCHANGE_NAME);
      expect(ConfigManager.EXCHANGE_TYPE).toBe(ExchangeType.TOPIC);
    });
  });

  describe('get', () => {
    it('should return the unprocessed value of the specified key', () => {
      expect(ConfigManager.get('STRING')).toBe('test');
      expect(ConfigManager.get('NUMBER')).toBe('123');
      expect(ConfigManager.get('BOOLEAN')).toBe('true');
    });
  });

  describe('getBool', () => {
    it('should return unprocessed value of the specified key as boolean', () => {
      expect(ConfigManager.getBool('BOOLEAN')).toBe(true);
    });
  });

  describe('getBool', () => {
    it('should return unprocessed value of the specified key as number', () => {
      expect(ConfigManager.getInt('NUMBER')).toBe(123);
    });
  });
});
