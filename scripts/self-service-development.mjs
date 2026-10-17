import { spawn } from "node:child_process";

// A stable, separate local workspace. Never migrate or reset the user's daily databases.
const env = { ...process.env, OKUMA_TEST_RUN_ID: process.env.OKUMA_TEST_RUN_ID || "self-service-web", OKUMA_GROUPS_DEVELOPMENT: "1", OKUMA_SELF_SERVICE_DEVELOPMENT: "1" };
const setup = spawn(process.execPath, ["scripts/groups-development.mjs"], { stdio: "inherit", env });
const result = await new Promise((resolve, reject) => { setup.once("error", reject); setup.once("exit", resolve); });
if (result !== 0) process.exit(Number(result) || 1);
const server = spawn(process.execPath, ["node_modules/vite/bin/vite.js"], { stdio: "inherit", env });
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => server.kill(signal));
server.once("error", (error) => { console.error(error.message); process.exitCode = 1; });
server.once("exit", (code) => { process.exitCode = code || 0; });
