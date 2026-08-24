/**
 * Automatic manual mock for react-native-blob-util.
 *
 * The real package ships untranspiled ESM and is outside this project's
 * `transformIgnorePatterns` allowlist, so any test that even transitively
 * imports it fails to parse — which now includes every test touching
 * services/account.ts, several layers away from anything to do with files.
 *
 * Jest applies manual mocks for node_modules packages automatically, so this
 * makes the import harmless everywhere without each unrelated test having to
 * know the module exists. Tests that actually exercise filesystem behaviour
 * (mediaFiles, mediaVault, inlineAudio) declare their own `jest.mock` factory,
 * which takes precedence over this file.
 *
 * It is a working in-memory filesystem rather than a bag of jest.fn()s so that
 * a test reaching it by accident gets coherent behaviour instead of undefined.
 */
const files = new Map();

function normalize(path) {
  return typeof path === 'string' && path.startsWith('file://')
    ? decodeURIComponent(path.replace('file://', ''))
    : path;
}

const fs = {
  dirs: {
    CacheDir: '/mock-cache',
    DocumentDir: '/mock-documents',
    DownloadDir: '/mock-downloads',
  },
  async stat(path) {
    const file = files.get(normalize(path));
    if (file === undefined) throw new Error(`ENOENT ${path}`);
    return {size: file.length};
  },
  async exists(path) {
    return files.has(normalize(path));
  },
  async readFile(path) {
    const file = files.get(normalize(path));
    if (file === undefined) throw new Error(`ENOENT ${path}`);
    return file;
  },
  async writeFile(path, data) {
    files.set(normalize(path), data);
  },
  async appendFile(path, data) {
    files.set(normalize(path), (files.get(normalize(path)) ?? '') + data);
  },
  async unlink(path) {
    if (!files.delete(normalize(path))) throw new Error(`ENOENT ${path}`);
  },
  async mv(from, to) {
    const file = files.get(normalize(from));
    if (file === undefined) throw new Error(`ENOENT ${from}`);
    files.set(normalize(to), file);
    files.delete(normalize(from));
  },
  async slice() {
    throw new Error('react-native-blob-util mock: slice needs a per-test factory');
  },
  async ls(dir) {
    const prefix = `${normalize(dir)}/`;
    return [...files.keys()].filter(k => k.startsWith(prefix)).map(k => k.slice(prefix.length));
  },
};

module.exports = {
  __esModule: true,
  default: {
    fs,
    config: () => ({
      async fetch() {
        throw new Error('react-native-blob-util mock: fetch needs a per-test factory');
      },
    }),
    android: {
      actionViewIntent: async () => undefined,
    },
  },
};
