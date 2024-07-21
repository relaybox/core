export interface DsApiData {
  message?: string;
}

export interface DsResponse<T> {
  status: number;
  data: T;
  message?: string;
}

export interface DsErrorResponse {
  message: string;
  status?: number;
}

export interface LatencyLog {
  createdAt: string;
  receivedAt: string;
}
