#!/usr/bin/env node
// Next.js standalone output omits .next/static and public/.
// Without these, every CSS/JS chunk 404s -> unstyled flash -> hydration 500.
// Copy them into the standalone tree so server.js can serve them.
import fs from "node:fs";
import path from "node:path";

const standalone = ".next/standalone";
if (!fs.existsSync(standalone)) {
  console.log("postbuild:standalone: .next/standalone missing, skip");
  process.exit(0);
}

fs.cpSync(".next/static", path.join(standalone, ".next/static"), { recursive: true });
if (fs.existsSync("public")) {
  fs.cpSync("public", path.join(standalone, "public"), { recursive: true });
}
console.log("postbuild:standalone: copied .next/static and public into standalone");
