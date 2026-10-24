import tseslint from 'typescript-eslint'
import pluginVue from 'eslint-plugin-vue'

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'playwright-report/**', 'test-results/**'] },
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/essential'],
  {
    files: ['**/*.vue'],
    languageOptions: { parserOptions: { parser: tseslint.parser } },
  },
  {
    rules: {
      'vue/multi-word-component-names': 'off',
    },
  },
  {
    // the UAT helpers read JSON answers of the real API without a type for every endpoint
    files: ['e2e/uat/**/*.ts'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
)
