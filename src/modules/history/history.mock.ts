const DEFAULT_HISTORY_MESSAGE = {
  body: {
    message: 'asdsad'
  },
  sender: {
    clientId: 'VCLS4esuVkZm',
    connectionId: 'cxzq2e038vpw:5RryLJfc0ntm',
    user: {
      id: 'a2228dba-5e6b-46d0-bbb4-22addbe59668',
      clientId: 'VCLS4esuVkZm'
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
