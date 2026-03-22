import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { GATEWAY_READY_PREFIX } from "@wedding-planner/shared";
import { app, type BrowserWindow } from "electron";

let gatewayProcess: ChildProcess | null = null;

const logBuffer: Array<{
  level: "stdout" | "stderr";
  line: string;
  timestamp: number;
}> = [];
const MAX_LOG_BUFFER = 500;
let debugWindow: BrowserWindow | null = null;

export function setDebugWindow(win: BrowserWindow | null) {
  debugWindow = win;
}

export function getLogBuffer() {
  return logBuffer;
}

function pushLog(level: "stdout" | "stderr", line: string) {
  const entry = { level, line, timestamp: Date.now() };
  logBuffer.push(entry);
  if (logBuffer.length > MAX_LOG_BUFFER) {
    logBuffer.splice(0, logBuffer.length - MAX_LOG_BUFFER);
  }
  if (debugWindow && !debugWindow.isDestroyed()) {
    debugWindow.webContents.send("gateway-log", entry);
  }
}

export function spawnGateway(options?: {
  browserExe?: string;
}): Promise<number> {
  return new Promise((resolve, reject) => {
    let stdoutBuffer = "";
    let stderrBuffer = "";
    let settled = false;

    const handleStdoutLine = (line: string) => {
      if (!line) return;
      if (line.startsWith(GATEWAY_READY_PREFIX)) {
        clearTimeout(timeout);
        if (settled) return;
        settled = true;
        const port = parseInt(line.slice(GATEWAY_READY_PREFIX.length), 10);
        resolve(port);
      } else {
        pushLog("stdout", line);
      }
    };

    const handleStderrLine = (line: string) => {
      if (!line) return;
      console.error("[gateway]", line);
      pushLog("stderr", line);
    };

    const flushLines = (
      chunk: string,
      buffer: string,
      onLine: (line: string) => void,
    ) => {
      const combined = buffer + chunk;
      const lines = combined.split(/\r?\n/);
      const rest = lines.pop() ?? "";
      for (const line of lines) {
        onLine(line.trim());
      }
      return rest;
    };

    const gatewayPath = path.join(
      __dirname,
      "../../..",
      "gateway/dist/index.js",
    );

    // Use system node instead of Electron binary so native modules
    // (better-sqlite3, etc.) work with the correct NODE_MODULE_VERSION
    const nodePath = process.env.NODE_PATH_OVERRIDE || "node";

    gatewayProcess = spawn(nodePath, [gatewayPath], {
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: undefined,
        ...(options?.browserExe
          ? { BROWSER_EXECUTABLE_PATH: options.browserExe }
          : {}),
        // Avoid local port collisions (e.g. 4590 already used by a server instance).
        WP_GATEWAY_PORT: "0",
        // In packaged app, web-dist is in resourcesPath. In dev, it sits next to gateway/dist/.
        WEB_DIST_PATH: app.isPackaged
          ? path.join(process.resourcesPath, "web-dist")
          : path.join(path.dirname(gatewayPath), "../web-dist"),
        // cloudflared binary for tunnel feature
        CLOUDFLARED_PATH: app.isPackaged
          ? path.join(
              process.resourcesPath,
              "cloudflared",
              process.platform === "win32" ? "cloudflared.exe" : "cloudflared",
            )
          : path.join(
              __dirname,
              "../../cloudflared",
              process.platform === "win32" ? "cloudflared.exe" : "cloudflared",
            ),
      },
    });

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error("Gateway startup timed out"));
    }, 10000);

    gatewayProcess.stdout?.on("data", (data: Buffer) => {
      stdoutBuffer = flushLines(data.toString(), stdoutBuffer, handleStdoutLine);
    });

    gatewayProcess.stderr?.on("data", (data: Buffer) => {
      stderrBuffer = flushLines(data.toString(), stderrBuffer, handleStderrLine);
    });

    gatewayProcess.on("error", (err) => {
      clearTimeout(timeout);
      if (settled) return;
      settled = true;
      reject(err);
    });

    gatewayProcess.on("exit", (code) => {
      if (stdoutBuffer.trim()) {
        handleStdoutLine(stdoutBuffer.trim());
        stdoutBuffer = "";
      }
      if (stderrBuffer.trim()) {
        handleStderrLine(stderrBuffer.trim());
        stderrBuffer = "";
      }
      if (code !== 0 && code !== null) {
        clearTimeout(timeout);
        if (settled) return;
        settled = true;
        reject(new Error(`Gateway exited with code ${code}`));
      }
      gatewayProcess = null;
    });
  });
}

export async function stopGateway(): Promise<void> {
  if (!gatewayProcess) return;

  const proc = gatewayProcess;
  gatewayProcess = null;

  return new Promise((resolve) => {
    const killTimeout = setTimeout(() => {
      proc.kill("SIGKILL");
      resolve();
    }, 5000);

    proc.on("exit", () => {
      clearTimeout(killTimeout);
      resolve();
    });

    proc.kill("SIGTERM");
  });
}
