/**
 * Marks the compiled test build as CommonJS.
 *
 * `tsconfig.test.json` emits CommonJS, but the project's `package.json` declares
 * `"type": "module"`, so Node would otherwise load the emitted `.js` files as ES
 * modules. A nested manifest scopes the override to `.test-build` alone.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const target = resolve(dirname(fileURLToPath(import.meta.url)), "../.test-build");

mkdirSync(target, { recursive: true });
writeFileSync(resolve(target, "package.json"), `{ "type": "commonjs" }\n`);
