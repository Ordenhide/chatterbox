const path = require('path');
const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

/**
 * Metro configuration for the macOS client.
 *
 * This package exists because it is pinned to a different React Native than
 * the mobile app — see ./README.md — which means it needs its own
 * `node_modules`, and *that* is the entire difficulty here: the JavaScript it
 * builds lives one directory up, in `../src` and `../App.tsx`, shared with an
 * app resolving a different copy of React Native.
 *
 * Two settings keep those apart:
 *
 *   `watchFolders` lets Metro follow imports out of this package into the
 *   shared source, which it otherwise refuses to do.
 *
 *   `nodeModulesPaths` is then pinned to *this* package's node_modules and
 *   nothing else. Without it, shared source resolving `react-native` could be
 *   served the mobile app's copy — a completely different version of the
 *   framework — with the resulting failures appearing at runtime, far from the
 *   cause. The blockList below is the same rule enforced from the other side.
 */
const projectRoot = __dirname;
const sharedRoot = path.resolve(projectRoot, '..');

const config = {
  watchFolders: [sharedRoot],
  resolver: {
    nodeModulesPaths: [path.resolve(projectRoot, 'node_modules')],
    // The shared root is watched for *source*, never for packages. Escaping
    // this is how you end up with two Reacts in one bundle.
    blockList: [new RegExp(`^${path.resolve(sharedRoot, 'node_modules').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/.*$`)],
  },
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
  },
};

module.exports = mergeConfig(getDefaultConfig(projectRoot), config);
