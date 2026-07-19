import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

const defaultBudgetPath = "config/performance-budgets.json";
const defaultDistPath = "dist";

function toPosix(value) {
  return value.split(sep).join("/");
}

function listFiles(directory, root = directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(absolutePath, root));
    if (entry.isFile()) {
      const bytes = readFileSync(absolutePath);
      files.push({
        absolutePath,
        path: toPosix(relative(root, absolutePath)),
        bytes: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      });
    }
  }
  return files.sort((left, right) => left.path.localeCompare(right.path));
}

function assetReferences(content) {
  const references = new Set();
  for (const match of content.matchAll(/(?:\.\/|\/)?(?:assets\/)?([A-Za-z0-9_.-]+\.(?:css|js))(?:[?#][^"'\s)]*)?/g)) {
    references.add(match[1]);
  }
  return references;
}

function sortedLargest(files, limit = 10) {
  return [...files]
    .sort((left, right) => right.bytes - left.bytes || left.path.localeCompare(right.path))
    .slice(0, limit)
    .map(({ path, bytes }) => ({ path, bytes }));
}

function readBudgets(path) {
  const document = JSON.parse(readFileSync(path, "utf8"));
  if (document.schemaVersion !== 1 || !document.budgets || typeof document.budgets !== "object") {
    throw new Error("Performance budget config must use schemaVersion 1 and include budgets.");
  }
  return document.budgets;
}

function compareBudget(errors, label, actual, maximum) {
  if (!Number.isFinite(maximum) || maximum < 0) {
    errors.push(`${label} has an invalid configured budget.`);
    return;
  }
  if (actual > maximum) errors.push(`${label} is ${actual}; budget is ${maximum}.`);
}

export function analyzeBundle(options = {}) {
  const distDirectory = resolve(options.distDirectory ?? defaultDistPath);
  const budgetPath = resolve(options.budgetPath ?? defaultBudgetPath);
  if (!existsSync(distDirectory) || !statSync(distDirectory).isDirectory()) {
    throw new Error("Bundle analysis requires dist/. Run npm run build first.");
  }
  if (!existsSync(budgetPath)) throw new Error(`Performance budget file is missing: ${budgetPath}`);

  const files = listFiles(distDirectory);
  const javascript = files.filter((file) => file.path.endsWith(".js"));
  const css = files.filter((file) => file.path.endsWith(".css"));
  const sourceMaps = files.filter((file) => file.path.endsWith(".map"));
  const assets = [...javascript, ...css];
  const indexFile = files.find((file) => file.path === "index.html");
  if (!indexFile) throw new Error("Bundle analysis requires dist/index.html.");

  const indexReferences = assetReferences(readFileSync(indexFile.absolutePath, "utf8"));
  const referencedByBuild = new Set(indexReferences);
  for (const source of assets) {
    const content = readFileSync(source.absolutePath, "utf8");
    for (const reference of assetReferences(content)) referencedByBuild.add(reference);
  }

  const unreferencedAssets = assets
    .filter((file) => !referencedByBuild.has(basename(file.path)))
    .map((file) => file.path)
    .sort();
  const initialJavaScript = javascript.filter((file) => indexReferences.has(basename(file.path)));

  const hashGroups = new Map();
  for (const file of files) {
    const group = hashGroups.get(file.sha256) ?? [];
    group.push(file.path);
    hashGroups.set(file.sha256, group);
  }
  const duplicateHashGroups = [...hashGroups.entries()]
    .filter(([, paths]) => paths.length > 1)
    .map(([sha256, paths]) => ({ sha256, paths: paths.sort() }))
    .sort((left, right) => left.sha256.localeCompare(right.sha256));

  const metrics = {
    artifactFiles: files.length,
    artifactBytes: files.reduce((total, file) => total + file.bytes, 0),
    javascriptFiles: javascript.length,
    javascriptBytes: javascript.reduce((total, file) => total + file.bytes, 0),
    cssFiles: css.length,
    cssBytes: css.reduce((total, file) => total + file.bytes, 0),
    initialJavaScriptBytes: initialJavaScript.reduce((total, file) => total + file.bytes, 0),
    sourceMaps: sourceMaps.length,
    largestJavaScript: sortedLargest(javascript),
    largestCss: sortedLargest(css),
    duplicateHashGroups,
    unreferencedAssets,
    indexAssets: assets.filter((file) => indexReferences.has(basename(file.path))).map((file) => file.path),
  };

  const budgets = readBudgets(budgetPath);
  const errors = [];
  compareBudget(errors, "Total artifact bytes", metrics.artifactBytes, budgets.maxArtifactBytes);
  compareBudget(errors, "Total JavaScript bytes", metrics.javascriptBytes, budgets.maxJavaScriptBytes);
  compareBudget(errors, "Total CSS bytes", metrics.cssBytes, budgets.maxCssBytes);
  compareBudget(errors, "Initial JavaScript bytes", metrics.initialJavaScriptBytes, budgets.maxInitialJavaScriptBytes);
  compareBudget(errors, "Largest JavaScript bytes", metrics.largestJavaScript[0]?.bytes ?? 0, budgets.maxLargestJavaScriptBytes);
  compareBudget(errors, "Largest CSS bytes", metrics.largestCss[0]?.bytes ?? 0, budgets.maxLargestCssBytes);
  compareBudget(errors, "JavaScript file count", metrics.javascriptFiles, budgets.maxJavaScriptFiles);
  compareBudget(errors, "CSS file count", metrics.cssFiles, budgets.maxCssFiles);
  compareBudget(errors, "Source map count", metrics.sourceMaps, budgets.maxSourceMaps);
  compareBudget(errors, "Duplicate exact-hash group count", duplicateHashGroups.length, budgets.maxDuplicateHashGroups);
  compareBudget(errors, "Unreferenced JS/CSS asset count", unreferencedAssets.length, budgets.maxUnreferencedAssetFiles);

  return { metrics, budgets, errors };
}

export function main() {
  try {
    const result = analyzeBundle();
    console.log("Bundle quality analysis");
    console.log(JSON.stringify(result.metrics, null, 2));
    if (result.errors.length > 0) {
      for (const error of result.errors) console.error(`Budget failure: ${error}`);
      process.exitCode = 1;
      return;
    }
    console.log("Performance budgets passed.");
  } catch (error) {
    console.error(`Bundle quality analysis failed: ${error.message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
