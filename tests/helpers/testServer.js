"use strict";

/**
 * Test helper: spawns the REAL server.js as a child process inside an
 * isolated temp workspace so tests never touch the repo's real
 * data/hotel.json or public/uploads.
 *
 * server.js resolves `dataPath`/`uploadPath` via `__dirname`, so copying
 * server.js (+ its data/public dependencies) into a fresh temp dir and
 * spawning `node server.js` there makes it operate entirely on the copy.
 */

const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const PROJECT_ROOT = path.join(__dirname, "..", "..");

function copyRecursiveExcluding(src, dest, excludeNames) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      if (excludeNames.includes(entry)) continue;
      copyRecursiveExcluding(
        path.join(src, entry),
        path.join(dest, entry),
        excludeNames,
      );
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

function createIsolatedWorkspace() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "staynest-test-"));

  fs.copyFileSync(
    path.join(PROJECT_ROOT, "server.js"),
    path.join(tempDir, "server.js"),
  );
  fs.copyFileSync(
    path.join(PROJECT_ROOT, "package.json"),
    path.join(tempDir, "package.json"),
  );

  fs.mkdirSync(path.join(tempDir, "data"), { recursive: true });
  fs.copyFileSync(
    path.join(PROJECT_ROOT, "data", "hotel.json"),
    path.join(tempDir, "data", "hotel.json"),
  );

  // Exclude uploads/ — server.js recreates it itself via mkdirSync(recursive)
  // and we never want real uploaded media dragged into the test workspace.
  copyRecursiveExcluding(
    path.join(PROJECT_ROOT, "public"),
    path.join(tempDir, "public"),
    ["uploads"],
  );

  // admin.html lives OUTSIDE public/ (server.js serves it from views/, not
  // exposed via express.static) — must be copied too for GET /admin to work.
  copyRecursiveExcluding(
    path.join(PROJECT_ROOT, "views"),
    path.join(tempDir, "views"),
    [],
  );

  fs.symlinkSync(
    path.join(PROJECT_ROOT, "node_modules"),
    path.join(tempDir, "node_modules"),
    "dir",
  );

  return tempDir;
}

function buildEnv({ adminUser, adminPassword, skipEnvVars, port }) {
  const env = { ...process.env, PORT: String(port) };
  delete env.ADMIN_USER;
  delete env.ADMIN_PASSWORD;

  if (!skipEnvVars.includes("ADMIN_USER")) env.ADMIN_USER = adminUser;
  if (!skipEnvVars.includes("ADMIN_PASSWORD")) env.ADMIN_PASSWORD = adminPassword;

  return env;
}

function randomPort() {
  return 20000 + Math.floor(Math.random() * 20000);
}

function cleanupWorkspace(tempDir) {
  fs.rmSync(tempDir, { recursive: true, force: true });
}

/**
 * Starts a real server.js process with valid admin credentials and waits
 * until it reports it is listening. Resolves with a handle to make
 * requests against + a stop() to kill the process and delete the temp dir.
 */
function startServer({
  adminUser = "testadmin",
  adminPassword = "testpass123", // secret-allow: test fixture, không phải credential thật
} = {}) {
  const tempDir = createIsolatedWorkspace();
  const port = randomPort();
  const env = buildEnv({ adminUser, adminPassword, skipEnvVars: [], port });

  const proc = spawn(process.execPath, ["server.js"], { cwd: tempDir, env });

  let stdoutBuf = "";
  let stderrBuf = "";
  proc.stdout.on("data", (chunk) => {
    stdoutBuf += chunk.toString();
  });
  proc.stderr.on("data", (chunk) => {
    stderrBuf += chunk.toString();
  });

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      proc.kill("SIGKILL");
      cleanupWorkspace(tempDir);
      reject(
        new Error(
          `Server did not report ready within timeout.\nstdout=${stdoutBuf}\nstderr=${stderrBuf}`,
        ),
      );
    }, 8000);

    const onData = () => {
      const match = stdoutBuf.match(
        /StayNest đang chạy tại http:\/\/localhost:(\d+)/,
      );
      if (match) {
        clearTimeout(timeout);
        proc.stdout.off("data", onData);
        resolve({
          baseUrl: `http://localhost:${match[1]}`,
          tempDir,
          stop: () => stopServer(proc, tempDir),
        });
      }
    };
    proc.stdout.on("data", onData);

    proc.once("exit", (code) => {
      clearTimeout(timeout);
      cleanupWorkspace(tempDir);
      reject(
        new Error(
          `Server exited early with code ${code} before becoming ready.\nstderr=${stderrBuf}`,
        ),
      );
    });
  });
}

function stopServer(proc, tempDir) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      cleanupWorkspace(tempDir);
      resolve();
    };
    proc.once("exit", finish);
    proc.kill("SIGTERM");
    setTimeout(() => {
      try {
        proc.kill("SIGKILL");
      } catch {
        // already dead
      }
      finish();
    }, 2000);
  });
}

/**
 * Spawns server.js expecting it to exit immediately (used for the missing
 * ADMIN_USER/ADMIN_PASSWORD edge case) and resolves with the exit code +
 * captured stderr once the process has terminated.
 */
function spawnServerAndWaitForExit({
  adminUser = "testadmin",
  adminPassword = "testpass123", // secret-allow: test fixture, không phải credential thật
  skipEnvVars = [],
} = {}) {
  const tempDir = createIsolatedWorkspace();
  const port = randomPort();
  const env = buildEnv({ adminUser, adminPassword, skipEnvVars, port });

  const proc = spawn(process.execPath, ["server.js"], { cwd: tempDir, env });

  let stderrBuf = "";
  proc.stderr.on("data", (chunk) => {
    stderrBuf += chunk.toString();
  });

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      proc.kill("SIGKILL");
      cleanupWorkspace(tempDir);
      reject(
        new Error(
          `Expected process to exit quickly (missing env vars) but it kept running.\nstderr=${stderrBuf}`,
        ),
      );
    }, 5000);

    proc.once("exit", (code) => {
      clearTimeout(timeout);
      cleanupWorkspace(tempDir);
      resolve({ code, stderr: stderrBuf });
    });
  });
}

module.exports = {
  startServer,
  spawnServerAndWaitForExit,
  PROJECT_ROOT,
};
