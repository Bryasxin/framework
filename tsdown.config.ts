import { defineConfig } from "tsdown";

export default defineConfig({
	platform: "node",
	plugins: [],
	tsconfig: "./tsconfig.json",
	workspace: ["packages/*"],
	entry: "./src/index.ts",
	dts: true,
});
