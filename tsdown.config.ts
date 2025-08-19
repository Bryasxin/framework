import { defineConfig } from "tsdown";

export default defineConfig({
	platform: "node",
	plugins: [],
	target: "esnext",
	tsconfig: "./tsconfig.json",
	entry: {
		index: "./src/index.ts",
	},
	dts: true,
});
