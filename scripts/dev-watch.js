const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const workspaceRoot = path.resolve(__dirname, "..");
const srcDir = path.join(workspaceRoot, "src");
const distEntry = path.join(workspaceRoot, "dist", "main.js");
const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

let appProcess = null;
let buildRunning = false;
let rebuildQueued = false;
let rebuildTimer = null;
let stoppingForRestart = false;

function log(message) {
  console.log(`[dev-watch] ${message}`);
}

function runCommand(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: workspaceRoot,
      stdio: "inherit",
      shell: false,
    });

    child.on("exit", (code) => resolve(code ?? 1));
  });
}

async function buildProject() {
  log("Compilando proyecto...");
  const exitCode = await runCommand(npmCmd, ["run", "build"]);
  return exitCode === 0;
}

function stopApp() {
  if (!appProcess) {
    return;
  }

  stoppingForRestart = true;
  appProcess.kill();
  appProcess = null;
}

function startApp() {
  if (!fs.existsSync(distEntry)) {
    log("No se encontró dist/main.js después del build");
    return;
  }

  log("Levantando backend...");
  stoppingForRestart = false;
  appProcess = spawn(process.execPath, [distEntry], {
    cwd: workspaceRoot,
    stdio: "inherit",
    shell: false,
  });

  appProcess.on("exit", (code) => {
    if (!stoppingForRestart && code && code !== 0) {
      log(`El backend terminó con código ${code}`);
    }
    appProcess = null;
  });
}

async function rebuildAndRestart(reason) {
  if (buildRunning) {
    rebuildQueued = true;
    return;
  }

  buildRunning = true;
  log(`Cambio detectado en ${reason}. Reiniciando...`);
  stopApp();

  const ok = await buildProject();
  if (ok) {
    startApp();
  } else {
    log("El build falló; el backend no se reinició");
  }

  buildRunning = false;
  if (rebuildQueued) {
    rebuildQueued = false;
    await rebuildAndRestart("cambios pendientes");
  }
}

function scheduleRebuild(reason) {
  clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(() => {
    rebuildAndRestart(reason).catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      log(`Error durante el reinicio: ${message}`);
    });
  }, 250);
}

function watchPath(targetPath) {
  if (!fs.existsSync(targetPath)) {
    return null;
  }

  const isDirectory = fs.statSync(targetPath).isDirectory();
  return fs.watch(
    targetPath,
    { recursive: isDirectory },
    (_eventType, filename) => {
      scheduleRebuild(filename || targetPath);
    },
  );
}

async function main() {
  const watchers = [
    watchPath(srcDir),
    watchPath(path.join(workspaceRoot, "tsconfig.json")),
    watchPath(path.join(workspaceRoot, "nest-cli.json")),
    watchPath(path.join(workspaceRoot, ".env")),
  ].filter(Boolean);

  const shutdown = () => {
    clearTimeout(rebuildTimer);
    watchers.forEach((watcher) => watcher.close());
    stopApp();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  const ok = await buildProject();
  if (ok) {
    startApp();
  } else {
    log("El build inicial falló; quedo esperando cambios");
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  log(`Fallo fatal: ${message}`);
  process.exit(1);
});
