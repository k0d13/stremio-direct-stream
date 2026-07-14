import { createRouter } from "@stremio-addon/sdk";
import { addonInterface } from "../src/addon.js";
import { landingPage } from "../src/landing.js";
import { requestContext } from "../src/context.js";
import { clientIpFromRequest } from "../src/ip.js";

const router = createRouter(addonInterface);

/** Resolve a request to a response: landing page, addon route, or 404. */
async function route(request: Request, pathname: string): Promise<Response> {
  if (request.method === "GET" && (pathname === "/" || pathname === "/index.html")) {
    return new Response(landingPage(addonInterface.manifest), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  const res = await router(request);
  return res ?? new Response(null, { status: 404 });
}

/** Web-standard request handler shared by every runtime (Bun, Vercel, Workers). */
export async function handleRequest(
  request: Request,
  server?: { requestIP?: (req: Request) => { address: string } | null },
): Promise<Response> {
  const started = Date.now();
  const { pathname } = new URL(request.url);
  const clientIp = clientIpFromRequest(request, server);

  try {
    const response = await requestContext.run({ clientIp }, () =>
      route(request, pathname),
    );
    const ms = Date.now() - started;
    console.log(`[http] ${request.method} ${pathname} -> ${response.status} (${ms}ms)`);
    return response;
  } catch (err) {
    // A throw here would otherwise surface as an opaque 500 with no context.
    console.error(`[http] ${request.method} ${pathname} -> 500:`, err);
    return new Response(null, { status: 500 });
  }
}

// Default export shape consumed by Vercel functions and Cloudflare Workers.
export default { fetch: handleRequest };
