import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const PUBLIC_SITE_PLACEHOLDER = "https://example.invalid";

export function normalizeBuildPublicSiteUrl(value: string | undefined): string {
  if (!value?.trim()) return PUBLIC_SITE_PLACEHOLDER;
  const url = new URL(value.trim());
  if (!["http:", "https:"].includes(url.protocol) || !url.hostname) {
    throw new Error("VITE_PUBLIC_SITE_URL must be an absolute HTTP or HTTPS URL.");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error("VITE_PUBLIC_SITE_URL must not contain credentials, a query string, or a fragment.");
  }
  return url.toString().replace(/\/$/, "");
}

function publicSiteMetadataPlugin(publicSiteUrl: string): Plugin {
  return {
    name: "prefab-public-site-metadata",
    transformIndexHtml(html) {
      return html.split(PUBLIC_SITE_PLACEHOLDER).join(publicSiteUrl);
    },
    writeBundle(options) {
      const outputDirectory = resolve(options.dir ?? "dist");
      for (const filename of ["robots.txt", "sitemap.xml"]) {
        const path = resolve(outputDirectory, filename);
        const content = readFileSync(path, "utf8");
        writeFileSync(path, content.split(PUBLIC_SITE_PLACEHOLDER).join(publicSiteUrl), "utf8");
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), "");
  const publicSiteUrl = normalizeBuildPublicSiteUrl(environment.VITE_PUBLIC_SITE_URL);
  return {
    plugins: [react(), publicSiteMetadataPlugin(publicSiteUrl)],
    build: {
      sourcemap: false,
    },
  };
});
