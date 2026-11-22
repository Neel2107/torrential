// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'android/*', 'ios/*', 'modules/*/android/*', 'modules/*/ios/*'],
  },
  {
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'lucide-react-native',
              message: "Import each icon from 'lucide-react-native/icons/<name>'; the barrel ships all 1,600 icons.",
              allowTypeImports: true,
            },
          ],
        },
      ],
    },
  },
]);
