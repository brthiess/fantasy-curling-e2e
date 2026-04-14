import path from "node:path";
import fs from "node:fs";
import { config as loadEnv } from "dotenv";
import type { FullConfig } from "@playwright/test";
import { waitForHttpOk, waitForCondition } from "./http-utils";
import {
  assertPathExists,
  readOptionalEnv,
  stopManagedProcess
} from "./process-utils";
import { assertSeedCollections, seedMongoDatabase } from "./seed-mongo";
import { startBackendServer } from "./start-backend";
import { startFrontendServer } from "./start-frontend";
import { startIsolatedMongoContainer } from "./start-mongo";
import {
  runtimeDirectory,
  writeRuntimeState,
  type RuntimeState
} from "./runtime-state";

loadEnv();

const REQUIRED_FRONTEND_ENV = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
  "VITE_API_ENV"
] as const;

export default async function globalSetup(_config: FullConfig): Promise<void> {
  const frontendDir = path.resolve(
    process.env.FRONTEND_DIR ?? "../fantasy-curling-frontend"
  );
  const backendDir = path.resolve(
    process.env.BACKEND_DIR ?? "../fantasy-curling-backend"
  );

  const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";
  const backendUrl = process.env.BACKEND_URL ?? "http://localhost:3000";

  const frontendStartCommand =
    process.env.FRONTEND_START_COMMAND ?? "npm run dev -- --mode devlocal";
  const backendStartCommand =
    process.env.BACKEND_START_COMMAND ?? "npm run start:dev";

  assertPathExists(frontendDir, "Frontend directory");
  assertPathExists(backendDir, "Backend directory");
  assertPathExists(path.join(frontendDir, "package.json"), "Frontend package.json");
  assertPathExists(path.join(backendDir, "package.json"), "Backend package.json");
  assertPathExists(
    path.join(backendDir, "middleware", "test-public-key.pem"),
    "Backend JWT test public key"
  );

  for (const envName of REQUIRED_FRONTEND_ENV) {
    if (!readOptionalEnv(process.env, envName)) {
      throw new Error(`Missing required frontend env var: ${envName}`);
    }
  }

  fs.mkdirSync(runtimeDirectory, { recursive: true });

  const externalMongoUrl = readOptionalEnv(process.env, "MONGO_URL");
  const mongoRuntime = await startIsolatedMongoContainer({
    externalMongoUrl
  });
  const { mongoUrl } = mongoRuntime;

  let backendPid = -1;
  let frontendPid = -1;

  try {
    if (mongoRuntime.strategy !== "testcontainers") {
      console.warn(
        "[e2e] Testcontainers unavailable, using external MONGO_URL fallback."
      );
    }

    await seedMongoDatabase(mongoUrl);
    await assertSeedCollections(mongoUrl);

    const backendProcess = startBackendServer({
      backendDir,
      backendStartCommand,
      mongoUrl,
      cmsAuth: readOptionalEnv(process.env, "CMS_AUTH")
    });
    backendPid = backendProcess.pid;

    const backendReadyEndpoint = process.env.BACKEND_READY_ENDPOINT ?? "/";
    await waitForHttpOk(
      `${backendUrl}${backendReadyEndpoint.startsWith("/") ? "" : "/"}${backendReadyEndpoint}`,
      120_000
    );

    await waitForCondition("seeded collections availability", async () => {
      try {
        await assertSeedCollections(mongoUrl);
        return true;
      } catch {
        return false;
      }
    });

    const frontendProcess = startFrontendServer({
      frontendDir,
      frontendStartCommand
    });
    frontendPid = frontendProcess.pid;

    await waitForHttpOk(frontendUrl, 120_000);

    const state: RuntimeState = {
      mongoUrl,
      mongoContainerId: mongoRuntime.mongoContainerId,
      mongoRuntimeStrategy: mongoRuntime.strategy,
      backendUrl,
      frontendUrl,
      backendPid,
      frontendPid
    };
    writeRuntimeState(state);

    process.env.E2E_RUNTIME_STATE_PATH = path.join(runtimeDirectory, "state.json");
  } catch (error) {
    if (backendPid > 0) {
      stopManagedProcess(backendPid);
    }
    if (frontendPid > 0) {
      stopManagedProcess(frontendPid);
    }
    await mongoRuntime.stop();
    throw error;
  }
}
