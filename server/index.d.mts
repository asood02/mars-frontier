// Type surface for the relay server entry so TS tests can import startServer.
export function startServer(port?: number): { close(cb?: () => void): void };
