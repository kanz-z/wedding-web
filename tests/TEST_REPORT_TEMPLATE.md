# E2E Test Report

**Date:** YYYY-MM-DD HH:MM
**Duration:** Xm Ys
**Base URL:** [URL]
**Status:** ✅ PASSING / ❌ FAILING

## Summary

| Metric | Count |
|--------|-------|
| Total | X |
| Passed | Y (Z%) |
| Failed | A |
| Flaky | B |
| Skipped | C |

## Failed Tests

### [test-name]
- **File:** `tests/e2e/[feature].spec.ts:NN`
- **Error:** [error message]
- **Screenshot:** `test-results/[name].png`
- **Trace:** `test-results/[name].zip`
- **Video:** `test-results/[name].webm`
- **Recommended Fix:** [description]

## Flaky Tests

### [test-name]
- **File:** `tests/e2e/[feature].spec.ts:NN`
- **Issue:** #[issue-number]
- **Pattern:** [intermittent failure description]
- **Mitigation:** test.fixme / test.skip / retry

## Artifacts

- **HTML Report:** `playwright-report/index.html`
- **Screenshots:** `test-results/*.png` (only-on-failure)
- **Videos:** `test-results/*.webm` (retain-on-failure)
- **Traces:** `test-results/*.zip` (on-first-retry)
- **JUnit XML:** `test-results/junit.xml`

## How to Read This Report

1. Buka `playwright-report/index.html` di browser untuk visual report interaktif
2. Buka trace dengan: `npx playwright show-trace test-results/[name].zip`
3. Lihat screenshot untuk inspeksi visual state saat failure
4. Video memberikan timeline lengkap sebelum failure
