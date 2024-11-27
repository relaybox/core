import { JwtPayload } from 'jsonwebtoken';

export interface ConnectionAuth {
  token?: string;
  apiKey?: string;
  clientId?: string;
  connectionId?: string;
  uid?: string;
}

export interface ExtendedJwtPayload extends JwtPayload {
  grant?: string;
  email_verified?: string;
}

export interface ExtendedClientJwtPayload extends JwtPayload {
  publicKey: string;
  clientId?: string | string[];
  timestamp: string;
}

export interface PasswordSaltPair {
  password: string | null;
  salt: string | null;
}
