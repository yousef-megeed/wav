// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    files: ["src/components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            "@/src/services/*",
            "@/src/repositories/*",
            "@/src/lib/supabase",
          ],
        },
      ],
    },
  },
  {
    files: ["src/hooks/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: ["@/src/repositories/*", "@/src/lib/supabase"],
        },
      ],
    },
  },
  {
    files: ["src/services/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            "@/src/hooks/*",
            "@/src/components/*",
            "@/src/screens/*",
            "@/src/navigation/*",
          ],
        },
      ],
    },
  },
  {
    files: ["src/repositories/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            "@/src/services/*",
            "@/src/hooks/*",
            "@/src/components/*",
            "@/src/screens/*",
            "@/src/navigation/*",
          ],
        },
      ],
    },
  },
]);
