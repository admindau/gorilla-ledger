import { spawn } from "node:child_process";

const port = 3107;
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)], {
  stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, PORT: String(port) },
});

let output = "";
server.stdout.on("data", (chunk) => { output += chunk; });
server.stderr.on("data", (chunk) => { output += chunk; });

async function waitFor(path) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}${path}`, { redirect: "manual" });
      if (response.status < 500) return response;
    } catch {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${path}.\n${output}`);
}

try {
  const home = await waitFor("/");
  const login = await waitFor("/auth/login");
  if (home.status !== 200 || login.status !== 200) throw new Error(`Unexpected status: home=${home.status}, login=${login.status}`);
  for (const response of [home, login]) {
    if (!response.headers.get("content-security-policy")) throw new Error("CSP header is missing.");
    if (!response.headers.get("x-request-id")) throw new Error("Request correlation header is missing.");
  }
  console.log("Production smoke passed for / and /auth/login.");
} finally {
  server.kill("SIGTERM");
}
