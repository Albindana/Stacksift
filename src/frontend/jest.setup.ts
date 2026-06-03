import "@testing-library/jest-dom";
import { toHaveNoViolations } from "jest-axe";

// Suppress act() noise from async callbacks (Next.js requestIdleCallback,
// react-hook-form) that fire after test assertions in jsdom. Tests are correct.
const originalError = console.error.bind(console);
beforeAll(() => {
  console.error = (...args: Parameters<typeof console.error>) => {
    const msg = typeof args[0] === "string" ? args[0] : "";
    if (
      msg.includes("not configured to support act(") ||
      msg.includes("not wrapped in act(")
    ) {
      return;
    }
    originalError(...args);
  };
});
afterAll(() => {
  console.error = originalError;
});

expect.extend(toHaveNoViolations);
