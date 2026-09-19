import {expect, test} from '@playwright/test';

// The account is a 24-word recovery phrase, not an email/password pair (see
// LoginScreen.tsx and src/services/auth.ts) — these tests were written
// against an older email/password screen and had drifted silently because
// test:e2e isn't wired into ci.yml, so nothing ran them. Rewritten against
// the current phrase flow, still unauthenticated-only for the same reason as
// accessibility.spec.ts: signed-in screens need real Firebase data.

test('login screen boots in sign-in mode', async ({page}) => {
  await page.goto('/');

  await expect(page.getByRole('heading', {name: 'Chatterbox'})).toBeVisible();
  await expect(page.getByText('Sign in to continue')).toBeVisible();
  await expect(page.getByPlaceholder('Your 24-word recovery phrase')).toBeVisible();
  await expect(page.getByRole('button', {name: 'Sign In', exact: true})).toBeVisible();

  await expect(page.getByText('No account yet?')).toBeVisible();
  await expect(page.getByRole('button', {name: 'Create one'})).toBeVisible();
});

test('creating an account walks through the phrase, confirmation and display name', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', {name: 'Create one'}).click();

  // A fresh 24-word phrase is generated and shown, numbered, with a copy
  // button — this is the one and only time it's shown before confirmation.
  const wordCells = page.locator('ol li');
  await expect(wordCells).toHaveCount(24);
  await expect(page.getByRole('button', {name: 'Copy'})).toBeVisible();

  // Read the phrase back off the screen: the confirmation step asks for three
  // specific words from it, chosen at random each visit, so the test has to
  // look up the right answers rather than hard-code them.
  const wordByIndex = new Map<number, string>();
  for (let i = 0; i < (await wordCells.count()); i++) {
    const cell = wordCells.nth(i);
    const index = Number(await cell.locator('span').nth(0).innerText());
    const word = await cell.locator('span').nth(1).innerText();
    wordByIndex.set(index, word);
  }

  await page.getByRole('button', {name: "I've written it down"}).click();

  await expect(page.getByText('Check you kept them')).toBeVisible();
  const confirmFields = page.locator('label').filter({hasText: /^Word \d+$/});
  await expect(confirmFields).toHaveCount(3);

  const createBtn = page.getByRole('button', {name: 'Create account'});
  await expect(createBtn).toBeDisabled();

  for (let i = 0; i < 3; i++) {
    const field = confirmFields.nth(i);
    // The label reads "Word 7" in the DOM but renders as "WORD 7"
    // (styles.fieldLabel sets textTransform: uppercase), which innerText()
    // reflects — pull the digits out rather than assume the case.
    const n = Number((await field.locator('span').innerText()).match(/\d+/)?.[0]);
    await field.locator('input').fill(wordByIndex.get(n) ?? '');
  }

  // The confirmation is client-side and specific to the words asked for —
  // typing the right three enables account creation without ever submitting
  // it (that would be a real sign-up against live Firebase).
  await expect(createBtn).toBeEnabled();

  await expect(page.getByPlaceholder('Display name (optional)')).toBeVisible();
});

test('typing the wrong word keeps the create-account button disabled', async ({page}) => {
  await page.goto('/');
  await page.getByRole('button', {name: 'Create one'}).click();
  await page.getByRole('button', {name: "I've written it down"}).click();

  const confirmFields = page.locator('label').filter({hasText: /^Word \d+$/});
  for (let i = 0; i < (await confirmFields.count()); i++) {
    await confirmFields.nth(i).locator('input').fill('not-the-right-word');
  }

  await expect(page.getByRole('button', {name: 'Create account'})).toBeDisabled();
});
