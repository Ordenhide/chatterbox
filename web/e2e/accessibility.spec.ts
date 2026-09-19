import AxeBuilder from '@axe-core/playwright';
import {expect, test} from '@playwright/test';

// Unauthenticated-only, deliberately — signed-in screens need real Firebase
// data and aren't safe to exercise in CI (see the .scratch-*.mjs pattern
// used for manual authenticated verification elsewhere in this repo's
// history). This still guards the one screen every user hits regardless of
// account state, and is where the "every input relies on a placeholder with
// no accessible name" class of bug would first show up.
//
// The account is a 24-word recovery phrase, not an email/password pair (see
// LoginScreen.tsx) — this file's "sign up" variant tested a form that no
// longer exists. Rewritten against the phrase flow's own two modes.
//
// Reduced motion, deliberately: LoginScreen wraps its content in Cascade,
// which fades and slides each element in over ~0.5s (see cbCascadeIn in
// styles.css). Scanning mid-animation caught the *opacity* as part of the
// rendered color and reported color-contrast violations that were really
// just an in-flight frame — axe has no way to know the element is still
// animating toward its resting state. prefers-reduced-motion is this app's
// own opt-out (one blanket rule in styles.css turns every animation into an
// instant state change), so asking for it here measures the same steady
// state a real reduced-motion user sees, not an arbitrary wait long enough
// to outlast 0.5s plus whatever cascade delay the element has.
test.use({reducedMotion: 'reduce'});

test('login screen (sign in) has no automatically-detectable accessibility violations', async ({page}) => {
  await page.goto('/');
  // Past the initial mount: the web font swap and first paint briefly render
  // with fallback metrics/colors that axe would otherwise catch as if they
  // were the resting state.
  await page.waitForLoadState('networkidle');
  await expect(page.getByPlaceholder('Your 24-word recovery phrase')).toBeVisible();

  const results = await new AxeBuilder({page}).analyze();
  expect(results.violations).toEqual([]);
});

test('login screen (create account) has no automatically-detectable accessibility violations', async ({page}) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', {name: 'Create one'}).click();
  await expect(page.getByRole('button', {name: 'Copy'})).toBeVisible();

  const results = await new AxeBuilder({page}).analyze();
  expect(results.violations).toEqual([]);
});
