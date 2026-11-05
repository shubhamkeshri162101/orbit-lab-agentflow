import { transformAsync } from "@babel/core";
import react from "@vitejs/plugin-react";
import rsdPostCssPlugin from "postcss-react-strict-dom";
import { defineConfig, type Plugin } from "vite";

// @vitejs/plugin-react only runs its babel pipeline on files it heuristically
// detects as JSX source, so it skips react-strict-dom's already-compiled
// dist/*.js (and @oaknorthbank's .ts files), leaving their `stylex.create`
// calls unexpanded. This plugin runs the StyleX babel preset unconditionally
// on anything from those packages, regardless of file shape.
function timberStylexTransform(): Plugin {
  const TARGET = /node_modules\/(react-strict-dom|@oaknorthbank)\/.*\.(jsx?|tsx?)$/;
  return {
    name: "timber-stylex-transform",
    enforce: "pre",
    async transform(code, id) {
      const filePath = id.split("?")[0];
      if (!TARGET.test(filePath) || filePath.includes(".d.ts") || filePath.includes(".native.")) return null;
      const result = await transformAsync(code, {
        filename: filePath,
        babelrc: false,
        configFile: false,
        presets: [
          ["@babel/preset-react", { runtime: "automatic" }],
          "@babel/preset-typescript",
          "react-strict-dom/babel-preset",
        ],
        sourceMaps: true,
      });
      if (!result?.code) return null;
      return { code: result.code, map: result.map };
    },
  };
}

export default defineConfig({
  plugins: [timberStylexTransform(), react()],
  css: {
    postcss: {
      plugins: [
        rsdPostCssPlugin({
          include: [
            "node_modules/@oaknorthbank/**/*.ts",
            "node_modules/@oaknorthbank/**/*.tsx",
          ],
          exclude: ["**/*.d.ts", "**/*.native.ts", "**/*.native.tsx"],
          babelConfig: {
            presets: [
              ["@babel/preset-react", { runtime: "automatic" }],
              "@babel/preset-typescript",
              "react-strict-dom/babel-preset",
            ],
          },
        }),
      ],
    },
  },
  // These packages ship raw TS/StyleX source, which esbuild's pre-bundler can't
  // process (it strips types but leaves `stylex.create` calls unevaluated).
  // Excluding them routes them through the babel pipeline above instead.
  optimizeDeps: {
    exclude: [
      "@oaknorthbank/components",
      "@oaknorthbank/graphics",
      "react-strict-dom",
      "react-strict-dom/runtime",
    ],
    // dayjs etc. are CJS deps pulled in by Timber's excluded source; force them
    // through esbuild's CJS->ESM interop since the module graph can't do it.
    include: ["dayjs", "dayjs/plugin/customParseFormat"],
  },
  resolve: {
    extensions: [".web.tsx", ".web.ts", ".tsx", ".mts", ".ts", ".jsx", ".mjs", ".js", ".css", ".json"],
  },
  server: { port: 5173 },
});
