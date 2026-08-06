---
title: "Installation"
description: "Install the package and how to run it, since it ships as TypeScript source with no compiled output."
---

```bash
npm install @michaelrwalker/search
```

## No build step

If you already compile TypeScript for your own code (a bundler like esbuild,
Vite, or tsup, webpack with `ts-loader`, a `tsc` build step, or Node's own
type-stripping support), you're covered: that same setup compiles this
package too, nothing extra to configure.

Search ships as TypeScript source rather than a compiled `dist` directory:
`package.json` points `main`, `types`, and the `"."` export directly at
`main.ts`, and it has zero runtime dependencies.

```json
{
	"main": "main.ts",
	"types": "main.ts",
	"exports": { ".": "./main.ts" }
}
```

## Running it under plain Node

If you are running TypeScript directly with Node, use the experimental type
stripping flags:

```bash
node --experimental-transform-types --disable-warning=ExperimentalWarning your-file.ts
```

The package's own examples and tests run this way. See
`examples/basic.ts` and `examples/customAlgorithm.ts` in the repository.

## Importing

```ts
import { Search, NaiveSearch, Levenshtein } from "@michaelrwalker/search";
```
