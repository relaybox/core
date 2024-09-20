const DEFAULT_HISTORY_MESSAGE = {
  body: {
    message: 'asdsad'
  },
  sender: {
    clientId: 'VCLS4esuVkZm',
    connectionId: 'cxzq2e038vpw:5RryLJfc0ntm',
    user: {
      id: 'a2228dba-5e6b-46d0-bbb4-22addbe59668',
      clientId: 'VCLS4esuVkZm',
      createdAt: '2024-09-20T07:53:02.168Z',
      updatedAt: '2024-09-20T07:53:02.168Z',
      username: 'ZanyToad464',
      orgId: '663684d4-54a8-4b7a-a7e2-dbc9720f1296',
      appId: 'a46e80e5-52af-4f23-a195-69a66e21f616',
      isOnline: null,
      lastOnline: null,
      blockedAt: null
    }
  },
  timestamp: 1726818823720,
  event: 'custom'
};

export function getMockHistoryMessage(message: Partial<typeof DEFAULT_HISTORY_MESSAGE> = {}): any {
  return {
    score: message.timestamp,
    value: JSON.stringify({
      ...DEFAULT_HISTORY_MESSAGE,
      ...message
    })
  };
}

export function getMockHistoryMessagesRange(count: number, end: number, msGap = 5000): any[] {
  const messages = [];

  let timestamp;

  for (let i = 0; i < count; i++) {
    timestamp = (timestamp || end) - msGap;

    messages.push(
      getMockHistoryMessage({
        ...DEFAULT_HISTORY_MESSAGE,
        timestamp
      })
    );
  }

  return messages;
}
