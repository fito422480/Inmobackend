const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const ts = require("typescript");

const workspaceRoot = __dirname;
const srcDir = path.join(workspaceRoot, "src");
const distEntry = path.join(workspaceRoot, "dist", "main.js");

let appProcess = null;
let buildRunning = false;
let rebuildQueued = false;
let rebuildTimer = null;
let stoppingForRestart = false;
let stopWaiters = [];

function log(message) {
  console.log(`[dev-watch] ${message}`);
}

function formatDiagnostics(diagnostics) {
  const host = {
    getCanonicalFileName: (fileName) => fileName,
    getCurrentDirectory: () => workspaceRoot,
    getNewLine: () => ts.sys.newLine,
  };

  console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics, host));
}

function buildProject() {
  log("Compilando proyecto...");

  const configPath = ts.findConfigFile(
    workspaceRoot,
    ts.sys.fileExists,
    "tsconfig.json",
  );

  if (!configPath) {
    log("No se encontró tsconfig.json");
    return false;
  }

  const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
  if (configFile.error) {
    formatDiagnostics([configFile.error]);
    return false;
  }

  const parsed = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    path.dirname(configPath),
  );
  parsed.options.incremental = false;

  const program = ts.createProgram({
    rootNames: parsed.fileNames,
    options: parsed.options,
  });
  const emitResult = program.emit();
  const diagnostics = ts
    .getPreEmitDiagnostics(program)
    .concat(emitResult.diagnostics);

  if (diagnostics.length > 0) {
    formatDiagnostics(diagnostics);
  }

  const hasErrors = diagnostics.some(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  );

  return !emitResult.emitSkipped && !hasErrors;
}

async function waitForBuildArtifacts() {
  const requiredFiles = [
    distEntry,
    path.join(workspaceRoot, "dist", "app.module.js"),
  ];
  const timeoutMs = 3000;
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (requiredFiles.every((filePath) => fs.existsSync(filePath))) {
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  const missing = requiredFiles
    .filter((filePath) => !fs.existsSync(filePath))
    .map((filePath) => path.relative(workspaceRoot, filePath));

  log(`El build terminó pero faltan archivos: ${missing.join(", ")}`);
  return false;
}

function resolveStopWaiters() {
  if (stopWaiters.length === 0) {
    return;
  }

  const waiters = stopWaiters;
  stopWaiters = [];
  waiters.forEach((resolve) => resolve());
}

function stopApp() {
  if (!appProcess) {
    return Promise.resolve();
  }

  stoppingForRestart = true;
  return new Promise((resolve) => {
    stopWaiters.push(resolve);
    appProcess.kill();
  });
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
    resolveStopWaiters();
  });
}

async function rebuildAndRestart(reason) {
  if (buildRunning) {
    rebuildQueued = true;
    return;
  }

  buildRunning = true;
  log(`Cambio detectado en ${reason}. Reiniciando...`);
  await stopApp();

  const ok = buildProject();
  if (ok && !rebuildQueued) {
    const artifactsReady = await waitForBuildArtifacts();
    if (artifactsReady) {
      startApp();
    }
  } else if (ok) {
    log("Se detectaron más cambios durante el build; recompilando antes de reiniciar");
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

  const ok = buildProject();
  if (ok) {
    const artifactsReady = await waitForBuildArtifacts();
    if (artifactsReady) {
      startApp();
    }
  } else {
    log("El build inicial falló; quedo esperando cambios");
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  log(`Fallo fatal: ${message}`);
  process.exit(1);
});
