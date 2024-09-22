import { mockQueue } from 'src/test/__mocks__/external/bullmq';
import { describe, expect, vi, it, afterEach } from 'vitest';
import { getMockSession } from '../session/session.mock';
import { addActiveMember, removeActiveMember, updateActiveMember } from './presence.service';
import { PresenceJobName } from './presence.queue';
import { getReducedSession } from '../session/session.service';

describe('presence.service', () => {
  const clientId = '12345';
  const session = getMockSession({ clientId });
  const nspRoomId = 'nsp:chat:one';
  const message = {};

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('addActiveMember', () => {
    it('should add active member to presence set by nsp room id and client id', async () => {
      const subscription = `${nspRoomId}:$:presence:join`;

      const reducedSession = getReducedSession(session);

      const jobData = {
        clientId,
        nspRoomId,
        subscription,
        session: reducedSession,
        message
      };

      await addActiveMember(clientId, nspRoomId, subscription, session, message);

      expect(mockQueue.add).toHaveBeenCalledWith(
        PresenceJobName.PRESENCE_JOIN,
        jobData,
        expect.any(Object)
      );
    });
  });

  describe('removeActiveMember', () => {
    it('should remove active member from presence set by nsp room id and client id', async () => {
      const subscription = `${nspRoomId}:$:presence:join`;

      const reducedSession = getReducedSession(session);

      const jobData = {
        clientId,
        nspRoomId,
        subscription,
        session: reducedSession,
        message
      };

      await removeActiveMember(clientId, nspRoomId, subscription, session, message);

      expect(mockQueue.add).toHaveBeenCalledWith(
        PresenceJobName.PRESENCE_LEAVE,
        jobData,
        expect.any(Object)
      );
    });
  });

  describe('updateActiveMember', () => {
    it('should update active member data by nsp room id and client id', async () => {
      const subscription = `${nspRoomId}:$:presence:join`;

      const reducedSession = getReducedSession(session);

      const jobData = {
        clientId,
        nspRoomId,
        subscription,
        session: reducedSession,
        message
      };

      await updateActiveMember(clientId, nspRoomId, subscription, session, message);

      expect(mockQueue.add).toHaveBeenCalledWith(
        PresenceJobName.PRESENCE_UPDATE,
        jobData,
        expect.any(Object)
      );
    });
  });
});
