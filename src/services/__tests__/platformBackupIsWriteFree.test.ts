/**
 * The recovery phrase is the whole account. Versions up to 1.2.0 copied it
 * into Block Store / iCloud Keychain on every sign-in; the copy restored
 * nothing once the phrase became the account, so the write path was removed.
 * This fails if any part of it comes back.
 */
import * as fs from 'fs';
import * as path from 'path';

const SRC = path.join(__dirname, '..', '..');
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), 'utf8');

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, {withFileTypes: true}).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

describe('the platform backup can only be deleted from', () => {
  const keyBackup = read('services/keyBackup.ts');

  it('reads the module it guards', () => {
    // Without this, a moved or renamed file would leave every check below
    // passing against an empty string.
    expect(keyBackup).toContain('.remove(service)');
    expect(keyBackup).toContain('resetGenericPassword(');
  });

  it('has no write or read call into either store', () => {
    expect(keyBackup).not.toMatch(/\.store\(/);
    expect(keyBackup).not.toMatch(/\.retrieve\(/);
    expect(keyBackup).not.toMatch(/\bsetGenericPassword\(/);
    expect(keyBackup).not.toMatch(/\bgetGenericPassword\(/);
  });

  it('is not reached for a writer anywhere else in src', () => {
    const files = sourceFiles(SRC);
    expect(files.length).toBeGreaterThan(50);
    const offenders = files.filter(f =>
      /saveRecoveryPhrase|loadRecoveryPhrase|NativeModules\??\.KeyBackup/.test(
        fs.readFileSync(f, 'utf8'),
      ) && !f.endsWith(path.join('services', 'keyBackup.ts')),
    );
    expect(offenders).toEqual([]);
  });

  it('is cleared on every launch, so accounts that never sign in again lose the old copy', () => {
    expect(read('contexts/AuthContext.tsx')).toMatch(/clearRecoveryPhrase\(user\.uid\)/);
  });
});
