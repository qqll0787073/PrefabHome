import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const LOCAL_SECRET_FILES = [".env.local", ".env.smoke.local", ".env.staging.local"];
const TRACKED_LOCAL_ENV = /(^|\/)\.env(?:\.[^/]+)?\.local$/i;
const TEXT_LIMIT_BYTES = 5 * 1024 * 1024;

const signaturePatterns = [
  { name: "private key block", expression: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: "Supabase access token", expression: /\bsbp_[A-Za-z0-9_-]{20,}\b/ },
  { name: "Supabase secret key", expression: /\bsb_secret_[A-Za-z0-9_-]{20,}\b/ },
  { name: "payment provider secret key", expression: /\bsk_(?:live|test)_[A-Za-z0-9]{16,}\b/ },
  { name: "AWS access key", expression: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "JWT-like credential", expression: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/ },
];

function gitTrackedFiles(root) {
  return execFileSync("git", ["ls-files", "-z"], {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
  })
    .split("\0")
    .filter(Boolean);
}

function readableTrackedFiles(root, trackedFiles) {
  const files = [];
  for (const relativePath of trackedFiles) {
    const absolutePath = resolve(root, relativePath);
    if (!existsSync(absolutePath)) continue;
    const content = readFileSync(absolutePath);
    if (content.length > TEXT_LIMIT_BYTES || content.includes(0)) continue;
    files.push({ relativePath, content: content.toString("utf8") });
  }
  return files;
}

function localSecretValues(root) {
  const values = [];
  for (const relativePath of LOCAL_SECRET_FILES) {
    const absolutePath = resolve(root, relativePath);
    if (!existsSync(absolutePath)) continue;
    for (const line of readFileSync(absolutePath, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!match) continue;
      const variableName = match[1];
      if (!/(?:PASSWORD|SECRET|TOKEN|KEY)$/i.test(variableName)) continue;
      const value = match[2].trim().replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/, "$1$2");
      if (value.length >= 8 && !/^(?:true|false|null|undefined)$/i.test(value)) values.push(value);
    }
  }
  return [...new Set(values)];
}

export function auditTrackedSecrets(root = process.cwd()) {
  const findings = [];
  const trackedFiles = gitTrackedFiles(root);

  for (const relativePath of trackedFiles) {
    if (TRACKED_LOCAL_ENV.test(relativePath.replaceAll("\\", "/"))) {
      findings.push({ relativePath, reason: "tracked local environment file" });
    }
  }

  const readableFiles = readableTrackedFiles(root, trackedFiles);
  for (const file of readableFiles) {
    for (const pattern of signaturePatterns) {
      if (pattern.expression.test(file.content)) {
        findings.push({ relativePath: file.relativePath, reason: pattern.name });
      }
    }
  }

  for (const secretValue of localSecretValues(root)) {
    for (const file of readableFiles) {
      if (file.content.includes(secretValue)) {
        findings.push({ relativePath: file.relativePath, reason: "matches a value from an ignored local environment file" });
      }
    }
  }

  return {
    trackedFileCount: trackedFiles.length,
    findings: findings.filter(
      (finding, index, all) =>
        all.findIndex(
          (candidate) => candidate.relativePath === finding.relativePath && candidate.reason === finding.reason
        ) === index
    ),
  };
}

function main() {
  const result = auditTrackedSecrets();
  if (result.findings.length > 0) {
    for (const finding of result.findings) {
      console.error(`- ${finding.relativePath}: ${finding.reason}`);
    }
    process.exitCode = 1;
    return;
  }
  console.log(`Tracked secret scan passed (${result.trackedFileCount} tracked files, 0 findings).`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
