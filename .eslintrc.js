module.exports = {
  root: true,
  extends: '@react-native',
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  overrides: [
    {
      files: ['*.ts', '*.tsx'],
      rules: {
        '@typescript-eslint/no-shadow': ['error'],
        'no-shadow': 'off',
        'no-undef': 'off',
        // React Native Firebase wraps the *native* Firebase SDKs, which exist
        // for iOS and Android and nowhere else — there is no HarmonyOS build of
        // them. Every import goes through src/services/firebase/ so that a port
        // can swap in the pure-JS Firebase SDK (same modular API, no native
        // code) in one place instead of forty-nine.
        //
        // This rule is the only thing keeping that true: the seam took a
        // 49-file rewrite to establish and a single direct import to undo.
        // See src/services/firebase/README.md.
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['@react-native-firebase/*'],
                message:
                  'Import from src/services/firebase/ instead — see its README. ' +
                  'Direct vendor imports cannot be swapped for the JS SDK on platforms with no native Firebase.',
              },
            ],
          },
        ],
      },
    },
    {
      // The seam is the one place allowed to name the vendor: that is its job.
      files: ['src/services/firebase/*.ts'],
      rules: {'no-restricted-imports': 'off'},
    },
  ],
};
