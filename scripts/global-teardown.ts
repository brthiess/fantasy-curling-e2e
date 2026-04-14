import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { stopManagedProcess } from "./process-utils";
import {
  readRuntimeState,
  runtimeDirectory,
  runtimeStatePath
} from "./runtime-state";

export default async function globalTeardown(): Promise<void> {
  const state = readRuntimeState();
  if (!state) {
    return;
  }

  stopManagedProcess(state.frontendPid);
  stopManagedProcess(state.backendPid);

  if (state.mongoContainerId) {
    spawnSync("docker", ["rm", "-f", state.mongoContainerId], {
      stdio: "ignore",
      shell: process.platform === "win32"
    });
  }

  if (fs.existsSync(runtimeStatePath)) {
    fs.rmSync(runtimeStatePath, { force: true });
  }
  if (fs.existsSync(runtimeDirectory)) {
    const entries = fs.readdirSync(runtimeDirectory);
    if (entries.length === 0) {
      fs.rmdirSync(runtimeDirectory);
    }
  }
}
