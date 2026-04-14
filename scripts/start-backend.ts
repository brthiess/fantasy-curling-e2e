import { runtimeDirectory } from "./runtime-state";
import { startManagedProcess, type ManagedProcess } from "./process-utils";

export function startBackendServer(params: {
  backendDir: string;
  backendStartCommand: string;
  mongoUrl: string;
  cmsAuth?: string;
}): ManagedProcess {
  return startManagedProcess({
    name: "backend",
    cwd: params.backendDir,
    command: params.backendStartCommand,
    env: {
      ...process.env,
      MONGO_URL: params.mongoUrl,
      NODE_ENV: "test",
      TZ: "UTC",
      ...(params.cmsAuth ? { CMS_AUTH: params.cmsAuth } : {})
    },
    runtimeDir: runtimeDirectory
  });
}
