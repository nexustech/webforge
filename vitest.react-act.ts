// React's `act()` needs to know it runs in a test, or it warns that the environment isn't configured
// to support it. Testing Library sets this itself; the tests that render with `createRoot` and
// `act()` rely on this file instead: one definition, a `setupFiles` entry of each project whose
// tests do (#991). A test that turns it off for a moment declares it for itself (tour-card.test.tsx).
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
