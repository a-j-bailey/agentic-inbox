// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
	plugins: [tsconfigPaths()],
	esbuild: {
		jsx: "automatic",
	},
	test: {
		include: ["shared/**/*.test.ts", "workers/**/*.test.ts", "app/**/*.test.tsx"],
		environment: "node",
	},
});
