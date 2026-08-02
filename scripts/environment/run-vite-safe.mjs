import { spawn, spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { localDevelopmentEnvironment } from "./safe-vite-environment.mjs";

const command = process.argv[2];
if (command !== "dev" && command !== "preview") {
  throw new Error("Safe Vite launcher supports only dev or preview.");
}

const environment = localDevelopmentEnvironment();
if (command === "preview") {
  const build = spawnSync(
    process.execPath,
    [resolve("node_modules/vite/bin/vite.js"), "build", "--mode", "preview", "--configLoader", "runner"],
    { env: environment, stdio: "inherit", windowsHide: true },
  );
  if (build.error) throw build.error;
  if (build.status !== 0) throw new Error("Safe preview build failed.");
}

const viteArguments = command === "preview"
  ? ["preview", "--mode", "preview"]
  : ["--mode", "development"];

const child = spawn(
  process.execPath,
  [resolve("node_modules/vite/bin/vite.js"), ...viteArguments, ...process.argv.slice(3)],
  {
    env: environment,
    stdio: "inherit",
    windowsHide: true,
  },
);

child.on("error", (error) => {
  console.error(`Safe local server failed to start: ${error.message}`);
  process.exitCode = 1;
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exitCode = code ?? 1;
});
