import 'src/test/__mocks__/external/bullmq';
import { describe, expect, vi, it, beforeEach, MockInstance, afterEach } from 'vitest';
import {
  getPartitionKey,
  getPartitionRange,
  getRoomHistoryMessages,
  HISTORY_MAX_SECONDS
} from './history.service';
import * as historyService from './history.service';
import * as historyRepository from './history.repository';
import { KeyPrefix } from '@/types/state.types';
import { HistoryOrder } from '@/types/history.types';
import { RedisClient } from '@/lib/redis';
import { getMockHistoryMessagesRange } from './history.mock';

describe('history.service', () => {
  describe('getPartitionKey', async () => {
    it('should return the correct date partition key for a given time and namespace', () => {
      const staticDateString = '2023-09-20T00:00:00.000Z';
      const staticTimestamp = new Date(staticDateString).getTime();
      const nspRoomId = 'room1';

      const result = getPartitionKey(nspRoomId, staticTimestamp);

      const expectedPartitionKey = `${KeyPrefix.HISTORY}:messages:room1:2023-09-20T00h`;

      expect(result).toBe(expectedPartitionKey);

      vi.useRealTimers();
    });
  });

  describe('getPartitionRange', async () => {
    it('should return the correct partition range for a given start and end time and order', () => {
      const startTime = 1690880000;
      const endTime = 1690883600;
      const order = HistoryOrder.DESC;

      const result = getPartitionRange(startTime, endTime, order);

      expect(result).toEqual({
        min: 1690880000,
        max: 1690883600
      });
    });
  });

  describe('getRoomHistoryMessages', async () => {
    let redisClient: RedisClient;

    let getPartitionKeySpy: MockInstance<Parameters<typeof getPartitionKey>, string>;
    let getPartitionRangeSpy: MockInstance<
      Parameters<typeof getPartitionRange>,
      { min: number; max: number }
    >;
    let getRoomHistoryMessagesSpy: MockInstance<
      Parameters<typeof historyRepository.getRoomHistoryMessages>,
      Promise<any>
    >;
    let nextTimeOutOfRangeSpy: MockInstance<
      Parameters<typeof historyService.nextTimeOutOfRange>,
      boolean
    >;
    let messagesLimitReachedSpy: MockInstance<
      Parameters<typeof historyService.messagesLimitReached>,
      boolean
    >;
    let getNextPageTokenSpy: MockInstance<
      Parameters<typeof historyService.getNextPageToken>,
      string | null
    >;

    beforeEach(() => {
      vi.useFakeTimers();
      redisClient = {} as RedisClient;
      getPartitionKeySpy = vi.spyOn(historyService, 'getPartitionKey');
      getPartitionRangeSpy = vi.spyOn(historyService, 'getPartitionRange');
      getRoomHistoryMessagesSpy = vi.spyOn(historyRepository, 'getRoomHistoryMessages');
      nextTimeOutOfRangeSpy = vi.spyOn(historyService, 'nextTimeOutOfRange');
      messagesLimitReachedSpy = vi.spyOn(historyService, 'messagesLimitReached');
      getNextPageTokenSpy = vi.spyOn(historyService, 'getNextPageToken');
    });

    beforeEach(() => {
      redisClient = {} as RedisClient;
    });

    afterEach(() => {
      vi.clearAllMocks();
      vi.resetAllMocks();
      vi.useRealTimers();
    });

    it('should retrieve maximum number of room history messages based on time range parameters', async () => {
      const mockedTime = new Date('2023-09-20T12:00:00Z').getTime();

      vi.setSystemTime(mockedTime);

      let lastScore = mockedTime;
      const getMessageRange = () => {
        const messages = getMockHistoryMessagesRange(10, lastScore, 5000);
        lastScore = messages[messages.length - 1].score;
        return messages;
      };

      getRoomHistoryMessagesSpy.mockImplementation(getMessageRange as any);

      const nspRoomId = 'room1';
      const start = mockedTime - 60 * 60 * 1000;
      const end = mockedTime;
      const seconds = 24 * 60 * 60;
      const limit = 100;
      const items = null;
      const order = HistoryOrder.DESC;
      const nextPageToken = null;

      const response = await getRoomHistoryMessages(
        redisClient,
        nspRoomId,
        start,
        end,
        seconds,
        limit,
        items,
        order,
        nextPageToken
      );

      expect(getRoomHistoryMessagesSpy).toHaveBeenCalledTimes(10);
      expect(response.nextPageToken).toBeDefined();
    });

    it('should throw an error when time range exceeds the maximum allowed range', async () => {
      const nspRoomId = 'room1';
      const start = new Date('2023-09-18T12:00:00Z').getTime();
      const end = new Date('2023-09-20T12:00:00Z').getTime();
      const seconds = 24 * 60 * 60;
      const limit = 100;
      const items = null;
      const order = HistoryOrder.DESC;
      const nextPageToken = null;

      await expect(
        getRoomHistoryMessages(
          redisClient,
          nspRoomId,
          start,
          end,
          seconds,
          limit,
          items,
          order,
          nextPageToken
        )
      ).rejects.toThrow(`Maximum time range of ${HISTORY_MAX_SECONDS / 60 / 60} hours exceeded`);
    });

    it.todo('should use nextPageToken to continue fetching messages', async () => {});

    it.todo('should handle empty result set', async () => {});

    it.todo('should log and throw an error if fetching messages fails', async () => {});
  });
});
