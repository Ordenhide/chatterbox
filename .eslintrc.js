module.exports = {
  root: true,
  extends: '@react-native',
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  overrides: [
    {
      files: ['*.ts', '*.tsx', '*.js'],
      rules: {
        '@typescript-eslint/no-shadow': ['error'],
        'no-shadow': 'off',
        'no-undef': 'off',
        /**
         * `_`-prefixed means "deliberately discarded", everywhere — not only
         * in argument lists.
         *
         * The default only exempts unused *arguments*, so the two idioms this
         * codebase uses for dropping a value were both reported as mistakes:
         * `const {[key]: _, ...rest} = prev` to omit one entry from an object,
         * and `const {key: _key, ...props} = props` to strip React's `key`
         * before spreading the rest onto a child (passing it through logs a
         * warning). Both are correct and neither has a rewrite that is
         * clearer, so the convention is recognised rather than worked around.
         *
         * Names without the underscore are still errors, which is the half
         * that catches real dead code — an unenforced 8MB image cap and a
         * multi-select mode with no delete button were both found this way.
         */
        '@typescript-eslint/no-unused-vars': [
          'error',
          {
            args: 'after-used',
            argsIgnorePattern: '^_',
            varsIgnorePattern: '^_',
            destructuredArrayIgnorePattern: '^_',
            caughtErrorsIgnorePattern: '^_',
            ignoreRestSiblings: true,
          },
        ],
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
