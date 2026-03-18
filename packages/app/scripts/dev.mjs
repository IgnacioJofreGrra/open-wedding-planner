#!/usr/bin/env node
import { spawn } from "node:child_process";

// Ensure electron child process behaves correctly even if parent shells set this.
delete process.env.ELECTRON_RUN_AS_NODE;

const child = spawn("npx electron-vite dev", {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
