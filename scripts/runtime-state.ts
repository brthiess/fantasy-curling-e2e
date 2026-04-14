import fs from "node:fs";
import path from "node:path";

export const runtimeDirectory = path.resolve(process.cwd(), ".e2e-runtime");
export const runtimeStatePath = path.join(runtimeDirectory, "state.json");

export type RuntimeState = {
  mongoUrl: string;
  mongoContainerId?: string;
  mongoRuntimeStrategy: "testcontainers" | "external-mongo-url";
  backendUrl: string;
  frontendUrl: string;
  backendPid: number;
  frontendPid: number;
};

export function writeRuntimeState(state: RuntimeState): void {
  fs.mkdirSync(runtimeDirectory, { recursive: true });
  fs.writeFileSync(runtimeStatePath, JSON.stringify(state, null, 2), "utf8");
}

export function readRuntimeState(): RuntimeState | null {
  if (!fs.existsSync(runtimeStatePath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(runtimeStatePath, "utf8")) as RuntimeState;
}
