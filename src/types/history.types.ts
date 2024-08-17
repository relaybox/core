export enum HistoryOrder {
  DESC = 'desc',
  ASC = 'asc'
}

export interface HistoryResponse {
  messages: any[];
  nextPageToken?: string | null;
  itemsRemaining?: number;
}
