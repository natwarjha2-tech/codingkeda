// Silence console output from route handlers during tests.
// Errors that matter will surface as test failures, not log noise.
jest.spyOn(console, "log").mockImplementation(() => {});
jest.spyOn(console, "error").mockImplementation(() => {});
