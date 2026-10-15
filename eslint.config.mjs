import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "src/.next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Electron 빌드 산출물
    "dist-electron/**",
  ]),
  // Electron main/preload는 Node CommonJS 모듈이다. require()가 정상·필수이므로
  // TypeScript 전용 규칙(no-require-imports)을 적용하지 않고 Node 전역을 허용한다.
  {
    files: ["electron/**/*.js"],
    languageOptions: {
      sourceType: "commonjs",
      globals: {
        require: "readonly",
        module: "writable",
        process: "readonly",
        __dirname: "readonly",
        console: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        setTimeout: "readonly",
      },
    },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
]);

export default eslintConfig;
