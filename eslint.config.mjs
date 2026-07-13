import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // react-hooks v5 added very strict rules that flag common idiomatic patterns.
      // useEffect(() => { load() }, []) is valid — disable the over-aggressive checks.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
      "react-hooks/immutability": "off",
      "react-hooks/refs": "off",

      // Pedantic JSX rule — &quot; entities are noise in JSX strings
      "react/no-unescaped-entities": "off",

      // Unused vars → warning only (don't block builds)
      "@typescript-eslint/no-unused-vars": "warn",
      // Codebase uses `any` pervasively for Supabase JSON fields — suppress
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
]);

export default eslintConfig;
