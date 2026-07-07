import {
  buildProviders,
  makeStandardFetcher,
  targets,
} from "@p-stream/providers";

export const providers = buildProviders()
  .setTarget(targets.ANY)
  .setFetcher(makeStandardFetcher(fetch))
  .addBuiltinProviders()
  .build();
