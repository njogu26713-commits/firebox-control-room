/** Shared application types. */
export type ConnectionStatus = "connected" | "degraded" | "failed";
export type ActivitySuccess = "yes" | "no";
export type PublicConnection = {
  id: string;
  appName: string;
  apiUrl: string;
  status: ConnectionStatus;
  apiVersion?: string;
  databaseType?: string;
  collectionCount: number;
  recordCount: number;
  lastConnectedAt?: Date;
  lastSyncAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};
export * from "./_core/errors";
