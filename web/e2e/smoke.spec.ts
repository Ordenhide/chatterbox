import {expect, test} from '@playwright/test';

test('login screen boots and can toggle to sign up', async ({page}) => {
  await page.goto('/');

  // Brand + sign-in CTA render on the login screen.
  await expect(page.getByRole('heading', {name: 'Chatterbox'})).toBeVisible();
  const signInBtn = page.getByRole('button', {name: 'Sign In', exact: true});
  await expect(signInBtn).toBeVisible();

  // The email/password fields are present.
  await expect(page.getByPlaceholder('Email')).toBeVisible();
  await expect(page.getByPlaceholder('Password')).toBeVisible();

  // Switching to sign-up reveals the display-name field.
  await page.getByRole('button', {name: 'Sign Up'}).click();
  await expect(page.getByPlaceholder('Display name (optional)')).toBeVisible();
});

test('empty submit shows a validation message', async ({page}) => {
  await page.goto('/');
  await page.getByRole('button', {name: 'Sign In', exact: true}).click();
  await expect(page.getByText('Enter your email and password.')).toBeVisible();
});
