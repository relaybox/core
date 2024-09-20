import { getLogger } from 'src/util/logger';
import { describe, expect, vi, it, beforeEach, MockInstance, afterEach } from 'vitest';
import { getPartitionKey, getPartitionRange, getRoomHistoryMessages } from './history.service';
import * as historyService from './history.service';
import * as historyRepository from './history.repository';
import { KeyPrefix } from 'src/types/state.types';
import { HistoryOrder } from 'src/types/history.types';
import { RedisClient } from 'src/lib/redis';
import { getMockHistoryMessagesRange } from './history.mock';

const logger = getLogger('');

const { mockBullMQAdd, mockBullMQGetJob } = vi.hoisted(() => {
  return {
    mockBullMQAdd: vi.fn(),
    mockBullMQGetJob: vi.fn()
  };
});

vi.mock('bullmq', () => {
  return {
    Queue: vi.fn().mockImplementation(() => ({
      add: mockBullMQAdd,
      getJob: mockBullMQGetJob
    }))
  };
});

const { mockGetRoomHistoryMessages } = vi.hoisted(() => {
  return {
    mockGetRoomHistoryMessages: vi.fn()
  };
});

vi.mock('./history.repository', () => ({
  getRoomHistoryMessages: mockGetRoomHistoryMessages
}));

describe('historyService', () => {
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
    // let getRoomHistoryMessagesSpy: MockInstance<
    //   Parameters<typeof historyRepository.getRoomHistoryMessages>,
    //   Promise<any>
    // >;
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
      // getRoomHistoryMessagesSpy = vi.spyOn(historyRepository, 'getRoomHistoryMessages');
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

    it('should retrieve room history messages with default parameters', async () => {
      const mockedTime = new Date('2023-09-20T12:00:00Z').getTime();

      vi.setSystemTime(mockedTime);

      let nextTime = mockedTime;
      const getMessageRange = () => {
        console.log(nextTime);
        const messages = getMockHistoryMessagesRange(2, nextTime, 5000);
        console.log(messages);
        nextTime = messages[messages.length - 1].score;
        console.log(nextTime);
        return messages;
      };

      mockGetRoomHistoryMessages.mockResolvedValue(getMessageRange());

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

      // console.log(response);
    });

    it('should throw an error when time range exceeds the maximum allowed range', async () => {});

    it('should use nextPageToken to continue fetching messages', async () => {});

    it('should handle empty result set', async () => {});

    it('should log and throw an error if fetching messages fails', async () => {});
  });
});
