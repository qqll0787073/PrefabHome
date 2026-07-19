import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { auditTrackedSecrets } from "./scan-tracked-secrets.mjs";

const TEXT_FILE = /\.(?:css|html|js|json|svg|txt|xml|webmanifest)$/i;
const HASHED_ASSET = /^assets\/.+-[A-Za-z0-9_-]{6,}\.(?:css|js)$/;
const LOCAL_ENV_FILE = /(^|\/)\.env(?:$|\.)|\.local$/i;
const ALLOWED_TRACKED_ENV_EXAMPLE = /(^|\/)\.env(?:\.[^/]+)?\.example$/i;
const LOCAL_SECRET_FILES = [".env.local", ".env.smoke.local", ".env.staging.local"];
const MAX_TEXT_BYTES = 5 * 1024 * 1024;
const SECRET_SIGNATURES = [
  { name: "private key", expression: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: "Supabase access token", expression: /\bsbp_[A-Za-z0-9_-]{20,}\b/ },
  { name: "Supabase secret key", expression: /\bsb_secret_[A-Za-z0-9_-]{20,}\b/ },
  { name: "payment provider secret", expression: /\bsk_(?:live|test)_[A-Za-z0-9]{16,}\b/ },
  { name: "AWS access key", expression: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "credentialed database URL", expression: /\bpostgres(?:ql)?:\/\/[^\s/:]+:[^\s/@]+@/i },
  { name: "Bearer credential", expression: /\bAuthorization\s*[:=]\s*Bearer\s+[A-Za-z0-9._~-]{16,}/i },
];

function toPosix(value) {
  return value.split(sep).join("/");
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function listFiles(directory, root = directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error(`Release artifact must not contain symbolic links: ${toPosix(relative(root, absolutePath))}`);
    }
    if (entry.isDirectory()) files.push(...listFiles(absolutePath, root));
    if (entry.isFile()) files.push({
      absolutePath,
      relativePath: toPosix(relative(root, absolutePath)),
      size: statSync(absolutePath).size,
    });
  }
  return files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function gitTrackedFiles(root) {
  return execFileSync("git", ["ls-files", "-z"], {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
  }).split("\0").filter(Boolean).map(toPosix);
}

function ignoredLocalSecretValues(root) {
  const values = [];
  for (const filename of LOCAL_SECRET_FILES) {
    const absolutePath = resolve(root, filename);
    if (!existsSync(absolutePath)) continue;
    for (const line of readFileSync(absolutePath, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!match || match[1] === "VITE_SUPABASE_ANON_KEY") continue;
      if (!/(?:PASSWORD|SECRET|TOKEN|KEY)$/i.test(match[1])) continue;
      const value = match[2].trim().replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/, "$1$2");
      if (value.length >= 8) values.push(value);
    }
  }
  return [...new Set(values)];
}

function localAssetReference(reference) {
  const parsed = new URL(reference, "https://artifact.invalid");
  if (parsed.origin !== "https://artifact.invalid") {
    throw new Error(`index.html must not load an external entry asset: ${parsed.origin}`);
  }
  return decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
}

function assertIndexAssets(indexHtml, filesByPath) {
  const references = [...indexHtml.matchAll(/<(?:script|link)\b[^>]*(?:src|href)=["']([^"']+\.(?:css|js)(?:[?#][^"']*)?)["']/gi)]
    .map((match) => localAssetReference(match[1]));
  const jsReferences = references.filter((path) => path.endsWith(".js"));
  const cssReferences = references.filter((path) => path.endsWith(".css"));
  if (jsReferences.length === 0 || cssReferences.length === 0) {
    throw new Error("index.html must reference at least one hashed JavaScript and CSS asset.");
  }
  for (const reference of references) {
    if (!HASHED_ASSET.test(reference)) {
      throw new Error(`index.html references a non-hashed JS/CSS asset: ${reference}`);
    }
    if (!filesByPath.has(reference)) {
      throw new Error(`index.html references a missing release asset: ${reference}`);
    }
  }
}

function assertNoSensitiveArtifactContent(files, root, publicAnonKey) {
  const ignoredSecrets = ignoredLocalSecretValues(root);
  for (const file of files) {
    if (!TEXT_FILE.test(file.relativePath) || file.size > MAX_TEXT_BYTES) continue;
    let content = readFileSync(file.absolutePath, "utf8");
    if (publicAnonKey) content = content.split(publicAnonKey).join("[PUBLIC_SUPABASE_KEY]");
    for (const signature of SECRET_SIGNATURES) {
      if (signature.expression.test(content)) {
        throw new Error(`Release artifact contains an obvious ${signature.name} signature in ${file.relativePath}.`);
      }
    }
    if (ignoredSecrets.some((secret) => content.includes(secret))) {
      throw new Error(`Release artifact contains a value from an ignored local secret file in ${file.relativePath}.`);
    }
  }
}

function assertTrackedRepositorySafety(root) {
  const trackedEnvironmentFiles = gitTrackedFiles(root).filter(
    (file) => LOCAL_ENV_FILE.test(file) && !ALLOWED_TRACKED_ENV_EXAMPLE.test(file),
  );
  if (trackedEnvironmentFiles.length > 0) {
    throw new Error(`Tracked local environment file is forbidden: ${trackedEnvironmentFiles.join(", ")}`);
  }
  const trackedAudit = auditTrackedSecrets(root);
  if (trackedAudit.findings.length > 0) {
    throw new Error("Tracked repository secret audit failed before artifact verification.");
  }
}

export function verifyProductionArtifact(options = {}) {
  const root = resolve(options.root ?? process.cwd());
  const distDirectory = resolve(root, options.distDirectory ?? "dist");
  const allowSourceMaps = options.allowSourceMaps ?? process.env.PREFAB_ALLOW_SOURCE_MAPS === "true";
  const checkTrackedRepository = options.checkTrackedRepository ?? true;
  const manifestDirectory = resolve(
    options.manifestDirectory ?? join(tmpdir(), "prefabhome-release-manifests"),
  );
  const publicAnonKey = options.publicAnonKey ?? process.env.VITE_SUPABASE_ANON_KEY ?? "";

  if (!existsSync(distDirectory) || !statSync(distDirectory).isDirectory()) {
    throw new Error("Production artifact directory dist/ does not exist. Run the build first.");
  }
  if (checkTrackedRepository) assertTrackedRepositorySafety(root);

  const files = listFiles(distDirectory);
  const filesByPath = new Map(files.map((file) => [file.relativePath, file]));
  const indexFile = filesByPath.get("index.html");
  if (!indexFile) throw new Error("Production artifact is missing dist/index.html.");

  const forbiddenEnvironmentFiles = files.filter((file) => LOCAL_ENV_FILE.test(file.relativePath));
  if (forbiddenEnvironmentFiles.length > 0) {
    throw new Error(`Release artifact contains an environment/local file: ${forbiddenEnvironmentFiles[0].relativePath}`);
  }
  const sourceMaps = files.filter((file) => file.relativePath.endsWith(".map"));
  if (sourceMaps.length > 0 && !allowSourceMaps) {
    throw new Error(`Public source maps are not approved: ${sourceMaps[0].relativePath}`);
  }

  const jsAndCss = files.filter((file) => /\.(?:css|js)$/i.test(file.relativePath));
  if (jsAndCss.length === 0 || jsAndCss.some((file) => !HASHED_ASSET.test(file.relativePath))) {
    throw new Error("Every release JavaScript and CSS asset must use a Vite content-hashed filename.");
  }

  assertIndexAssets(readFileSync(indexFile.absolutePath, "utf8"), filesByPath);
  assertNoSensitiveArtifactContent(files, root, publicAnonKey);

  const checksums = files.map((file) => ({
    path: file.relativePath,
    bytes: file.size,
    sha256: sha256(readFileSync(file.absolutePath)),
  }));
  const checksumDocument = checksums.map((file) => `${file.sha256}  ${file.path}`).join("\n") + "\n";
  const artifactSha256 = sha256(checksumDocument);
  const manifest = {
    schemaVersion: 1,
    artifactSha256,
    fileCount: checksums.length,
    totalBytes: checksums.reduce((total, file) => total + file.bytes, 0),
    sourceMapsAllowed: allowSourceMaps,
    release: {
      environment: process.env.VITE_DEPLOYMENT_ENV ?? "unknown",
      appVersion: process.env.VITE_APP_VERSION ?? "unknown",
      commitSha: process.env.VITE_COMMIT_SHA ?? "unknown",
    },
    files: checksums,
  };

  mkdirSync(manifestDirectory, { recursive: true });
  const manifestPath = join(manifestDirectory, `prefabhome-${artifactSha256}.json`);
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  return {
    artifactSha256,
    fileCount: manifest.fileCount,
    totalBytes: manifest.totalBytes,
    javascriptAssets: jsAndCss.filter((file) => file.relativePath.endsWith(".js")).length,
    cssAssets: jsAndCss.filter((file) => file.relativePath.endsWith(".css")).length,
    sourceMapCount: sourceMaps.length,
    manifestPath,
  };
}

export function main() {
  try {
    const result = verifyProductionArtifact();
    console.log("Production artifact verification passed.");
    console.log(`Files: ${result.fileCount}; bytes: ${result.totalBytes}; JS: ${result.javascriptAssets}; CSS: ${result.cssAssets}; source maps: ${result.sourceMapCount}.`);
    console.log(`Artifact SHA-256: ${result.artifactSha256}`);
    console.log(`Temporary manifest: ${result.manifestPath}`);
  } catch (error) {
    console.error(`Production artifact verification failed: ${error.message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
