import AxeBuilder from '@axe-core/playwright';
import {expect, test} from '@playwright/test';

// Unauthenticated-only, deliberately — signed-in screens need real Firebase
// data and aren't safe to exercise in CI (see the .scratch-*.mjs pattern
// used for manual authenticated verification elsewhere in this repo's
// history). This still guards the one screen every user hits regardless of
// account state, and is where the "every input relies on a placeholder with
// no accessible name" class of bug would first show up.

test('login screen (sign in) has no automatically-detectable accessibility violations', async ({page}) => {
  await page.goto('/');
  await expect(page.getByPlaceholder('Email')).toBeVisible();

  const results = await new AxeBuilder({page}).analyze();
  expect(results.violations).toEqual([]);
});

test('login screen (sign up) has no automatically-detectable accessibility violations', async ({page}) => {
  await page.goto('/');
  await page.getByRole('button', {name: 'Sign Up'}).click();
  await expect(page.getByPlaceholder('Display name (optional)')).toBeVisible();

  const results = await new AxeBuilder({page}).analyze();
  expect(results.violations).toEqual([]);
});
