/** @type {import('jest').Config} */
const config = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/__tests__"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: "tsconfig.jest.json" }],
  },
  // Reset all mocks between tests — prevents state leaking across it() blocks
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,

  // Suppress console output during test runs (use --verbose to see test names)
  // Route handler logs (console.log/error) are intentionally silenced in tests.
  silent: true,

  // Runs before every test file
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],

  // Coverage — only collected when --coverage flag is passed
  collectCoverageFrom: [
    "app/api/**/*.ts",
    "app/lib/**/*.ts",
    "!app/lib/prisma.ts", // singleton bootstrap, not unit-testable
  ],
  coverageReporters: ["text", "lcov", "html"],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};

module.exports = config;
