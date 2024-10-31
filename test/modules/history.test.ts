import { getPartitionKey } from '@/modules/history/history.service';
import { describe, expect, it } from 'vitest';

describe('getPartitionKey', () => {
  it('should floor the timestamp to the start of the minute and format the key correctly', () => {
    const timestamp = 1609459265; // 2021-01-01 00:01:05 UTC
    const expectedKey = 1609459260; // Start of the minute
    const result = getPartitionKey(timestamp);
    expect(result).toBe(expectedKey);
  });

  it('should handle timestamps exactly at the start of a minute', () => {
    const timestamp = 1609459200; // 2021-01-01 00:00:00 UTC
    const expectedKey = 1609459200;
    const result = getPartitionKey(timestamp);
    expect(result).toBe(expectedKey);
  });

  it('should correctly floor timestamps just before the next minute', () => {
    const timestamp = 1609459259; // 2021-01-01 00:00:59 UTC
    const expectedKey = 1609459200;
    const result = getPartitionKey(timestamp);
    expect(result).toBe(expectedKey);
  });

  it('should correctly floor multiple timestamps within the same minute', () => {
    const baseTimestamp = 1609459200; // 2021-01-01 00:00:00 UTC
    const expectedKey = 1609459200;

    for (let i = 0; i < 60; i++) {
      const timestamp = baseTimestamp + i; // 00:00:00 to 00:00:59
      const result = getPartitionKey(timestamp);
      expect(result).toBe(expectedKey);
    }
  });

  it('should correctly floor multiple timestamps across different minutes', () => {
    const timestamps = [
      1609459201, // 00:00:01
      1609459261, // 00:01:01
      1609459321, // 00:02:01
      1609459381 // 00:03:01
    ];
    const expectedKeys = [1609459200, 1609459260, 1609459320, 1609459380];

    timestamps.forEach((timestamp, index) => {
      const result = getPartitionKey(timestamp);
      expect(result).toBe(expectedKeys[index]);
    });
  });

  it('should handle non-integer timestamps by flooring to the nearest second', () => {
    const timestamp = 1609459200.789; // 2021-01-01 00:00:00.789 UTC
    const expectedKey = 1609459200;
    const result = getPartitionKey(timestamp);
    expect(result).toBe(expectedKey);
  });
});
