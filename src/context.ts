import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Per-request context threaded from the HTTP entry point down to getStreams.
 * The Stremio SDK's stream handler only receives { type, id }, so we can't pass
 * the client IP as an argument — AsyncLocalStorage carries it across the awaits
 * without touching the SDK's signature.
 */
export const requestContext = new AsyncLocalStorage<{ clientIp?: string }>();
