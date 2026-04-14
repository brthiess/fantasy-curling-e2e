import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

export type ManagedProcess = {
  pid: number;
  name: string;
  command: string;
  cwd: string;
  logPath: string;
};

export function startManagedProcess(params: {
  name: string;
  cwd: string;
  command: string;
  env: NodeJS.ProcessEnv;
  runtimeDir: string;
}): ManagedProcess {
  const { name, cwd, command, env, runtimeDir } = params;
  const [executable, ...args] = command.split(" ");
  const logPath = path.join(runtimeDir, `${name}.log`);

  fs.mkdirSync(runtimeDir, { recursive: true });
  const logFile = fs.createWriteStream(logPath, { flags: "w" });

  const child = spawn(executable, args, {
    cwd,
    env,
    shell: process.platform === "win32",
    detached: process.platform !== "win32"
  });

  child.stdout?.pipe(logFile);
  child.stderr?.pipe(logFile);

  child.on("exit", (code) => {
    logFile.write(`\n[${name}] exited with code ${code ?? "null"}\n`);
    logFile.end();
  });

  if (!child.pid) {
    throw new Error(`Failed to launch ${name} process`);
  }

  return {
    pid: child.pid,
    name,
    command,
    cwd,
    logPath
  };
}

export function stopManagedProcess(pid: number): void {
  if (Number.isNaN(pid) || pid <= 0) {
    return;
  }

  try {
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", `${pid}`, "/T", "/F"], { stdio: "ignore" });
      return;
    }

    process.kill(-pid, "SIGTERM");
  } catch {
    // process may already be gone
  }
}

export function assertPathExists(targetPath: string, label: string): void {
  if (!fs.existsSync(targetPath)) {
    throw new Error(`${label} does not exist: ${targetPath}`);
  }
}

export function readOptionalEnv(
  env: NodeJS.ProcessEnv,
  key: string
): string | undefined {
  const value = env[key];
  return value && value.trim().length > 0 ? value.trim() : undefined;
}
