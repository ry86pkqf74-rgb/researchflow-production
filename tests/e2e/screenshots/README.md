# E2E Test Screenshots

This directory stores screenshots captured during Playwright E2E tests.

## Screenshots

- `full-ai-workflow-complete.png` - Final state after full workflow test
- Screenshots are automatically captured on test failure

## Usage

Screenshots are captured:
1. Automatically on test failure
2. Explicitly via `page.screenshot()` in tests
3. At end of comprehensive workflow tests

## Cleanup

Old screenshots can be safely deleted. They are gitignored except for README.
