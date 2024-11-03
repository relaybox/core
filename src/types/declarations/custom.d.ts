// src/custom.d.ts

import 'redis';

/**
 * Extend the Redis Scripts interface to include the custom script.
 */
declare module 'redis' {
  /**
   * Interface representing the custom command's return value.
   */
  interface AddAndCleanupResult {
    removed: number;
  }

  interface Scripts {
    addAndCleanup: {
      /**
       * Executes the addAndCleanup Lua script.
       *
       * @param {string} key - The sorted set key (e.g., buffered_messages:<roomId>)
       * @param {string} member - Serialized message (JSON string)
       * @param {number} score - Message timestamp in milliseconds
       * @param {number} cutoff - Cutoff timestamp in milliseconds (current timestamp - retention period)
       * @returns {Promise<AddAndCleanupResult>} - Number of messages removed
       */
      (key: string, member: string, score: number, cutoff: number): Promise<AddAndCleanupResult>;
    };
  }
}
