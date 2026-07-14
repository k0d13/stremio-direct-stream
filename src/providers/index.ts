import {
  buildProviders,
  makeStandardFetcher,
  targets,
} from "@p-stream/providers";
import { vidsrcSource } from "./vidsrc.js";

export const providers = buildProviders()
  .setTarget(targets.ANY)
  .setFetcher(makeStandardFetcher(fetch))
  .addBuiltinProviders()
  .addSource(vidsrcSource)
  // VidSrc requires same IP, so unless we setup a proxy we can't always use it
  // TODO: proxy or make this configurable
  // .enableConsistentIpForRequests()
  .build();
