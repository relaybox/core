import { getMergedItems } from '@/modules/history/history.service';
import { Message } from '@/types/history.types';
import { getLogger } from '@/util/logger';
import { QueryOrder } from '@/util/pg-query';
import { describe, expect, it } from 'vitest';

const logger = getLogger('');

describe('history.service', () => {
  describe('getMergedItems', () => {
    const items = [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }] as Message[];

    const cachedMessagesForRange = [
      { id: '5' },
      { id: '6' },
      { id: '7' },
      { id: '8' }
    ] as Message[];

    it('should return the original items if there are no cached messages', () => {
      const result = getMergedItems(logger, items, [], QueryOrder.DESC, 10);
      expect(result).toEqual(items);
    });

    it('should prepend cached messages for descending order', () => {
      const itemsDescending = [...items].reverse();

      const result = getMergedItems(
        logger,
        itemsDescending,
        cachedMessagesForRange,
        QueryOrder.DESC,
        10
      );

      expect(result).toEqual([
        { id: '8' },
        { id: '7' },
        { id: '6' },
        { id: '5' },
        { id: '4' },
        { id: '3' },
        { id: '2' },
        { id: '1' }
      ]);
    });

    it('should append cached messages for ascending order', () => {
      const itemsAscending = [...items];

      const result = getMergedItems(
        logger,
        itemsAscending,
        cachedMessagesForRange,
        QueryOrder.ASC,
        10
      );

      expect(result).toEqual([
        { id: '1' },
        { id: '2' },
        { id: '3' },
        { id: '4' },
        { id: '5' },
        { id: '6' },
        { id: '7' },
        { id: '8' }
      ]);
    });
  });
});
