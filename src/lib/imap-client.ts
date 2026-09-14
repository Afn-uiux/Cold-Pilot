import { ImapFlow, type ImapFlowOptions } from "imapflow";

// ImapFlow is an EventEmitter. When the underlying socket times out (5-minute
// default SOCKET_TIMEOUT) or drops mid-operation, the library calls
// emitError() -> this.emit('error', err). Without an 'error' listener Node
// escalates it to an uncaughtException that can crash the process. Centralize
// creation here so every connection logs the socket failure instead of dying.
export function createImapClient(options: ImapFlowOptions): ImapFlow {
  const client = new ImapFlow(options);
  client.on("error", (err) => {
    const host = options.host;
    console.error(`[imap] socket error for ${host}:`, err?.message || err);
  });
  return client;
}