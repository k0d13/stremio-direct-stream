import { handleRequest } from "../api/index.js";

const server = Bun.serve({ port: 7000, fetch: handleRequest, idleTimeout: 60 });
console.log(`[server] Direct Stream addon listening at ${server.url}`);
