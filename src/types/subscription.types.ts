export enum SubscriptionType {
  JOIN = 'join',
  LEAVE = 'leave',
  UPDATE = 'update'
}

export interface ClientSubscription {
  subscriptionId: string;
  event: string;
}
