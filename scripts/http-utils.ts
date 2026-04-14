import { setTimeout as wait } from "node:timers/promises";

export async function waitForHttpOk(
  url: string,
  timeoutMs = 90_000,
  pollIntervalMs = 1_000
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url, { method: "GET" });
      if (response.ok) {
        return;
      }
    } catch {
      // service still booting
    }
    await wait(pollIntervalMs);
  }

  throw new Error(`Timed out waiting for OK response from ${url}`);
}

export async function waitForCondition(
  conditionName: string,
  predicate: () => Promise<boolean>,
  timeoutMs = 60_000,
  pollIntervalMs = 500
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await predicate()) {
      return;
    }
    await wait(pollIntervalMs);
  }

  throw new Error(`Timed out waiting for condition: ${conditionName}`);
}
