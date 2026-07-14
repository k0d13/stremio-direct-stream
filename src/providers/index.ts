import {
  buildProviders,
  flags,
  getBuiltinEmbeds,
  getBuiltinSources,
  makeStandardFetcher,
  targets,
  type ProviderControls,
} from "@p-stream/providers";
import { vidsrcSource } from "./vidsrc.js";
import { requestContext } from "../context.js";
import { getServerPublicIp, sameNetwork } from "../ip.js";

/**
 * Build a provider set tailored to the current request.
 *
 * Consistent-IP is *always* enabled. Its disabled path is the only one that
 * mutates the library's shared, module-level features object (pushing IP_LOCKED
 * into it), which permanently corrupts every later build — so we never take it.
 * IP-locked sources (vidsrc and the IP-locked builtins) are gated by omission
 * instead: added only for clients on our /24, since their tokens won't validate
 * from anywhere else (see src/ip.ts). That's also why we add builtins by hand
 * rather than via addBuiltinProviders() — we need to leave some out.
 */
export async function getProviders(): Promise<ProviderControls> {
  const clientIp = requestContext.getStore()?.clientIp;
  const local = sameNetwork(clientIp, await getServerPublicIp());
  console.log(
    `[providers] client ${clientIp ?? "?"} -> ${local ? "local" : "remote"}`,
  );

  const builder = buildProviders()
    .setTarget(targets.ANY)
    .setFetcher(makeStandardFetcher(fetch))
    .enableConsistentIpForRequests();

  for (const source of [...getBuiltinSources(), vidsrcSource])
    if (local || !source.flags.includes(flags.IP_LOCKED))
      builder.addSource(source);
  for (const embed of getBuiltinEmbeds()) builder.addEmbed(embed);
  return builder.build();
}
