module.exports = {
  setupFilesAfterEnv: ['<rootDir>/jest-setup.ts'],
  "preset": "ts-jest",
  "transform": {
    "^.+\\.js$": "babel-jest"
  },
  "testEnvironment": "jsdom",
  "globals": {
    "ts-jest": {
      "tsconfig": "<rootDir>/tsconfig.test.json"
    }
  }
};
