import { runtimeDirectory } from "./runtime-state";
import { startManagedProcess, type ManagedProcess } from "./process-utils";

export function startFrontendServer(params: {
  frontendDir: string;
  frontendStartCommand: string;
}): ManagedProcess {
  return startManagedProcess({
    name: "frontend",
    cwd: params.frontendDir,
    command: params.frontendStartCommand,
    env: {
      ...process.env,
      TZ: "UTC"
    },
    runtimeDir: runtimeDirectory
  });
}
