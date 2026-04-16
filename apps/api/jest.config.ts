import type { Config } from "jest";

const config: Config = {
  rootDir: ".",
  testEnvironment: "node",
  roots: ["<rootDir>/test"],
  moduleFileExtensions: ["ts", "js", "json"],
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        tsconfig: "<rootDir>/tsconfig.spec.json"
      }
    ]
  },
  moduleNameMapper: {
    "^@ecoms/contracts$": "<rootDir>/test/support/contracts.mock.ts"
  }
};

export default config;
