const tseslint = require('typescript-eslint')

module.exports = [
    { ignores: ['playwright-report/**', 'test-results/**', 'node_modules/**', '_output/**'] },
    {
        files: ['tests/**/*.ts', 'playwright.config.ts'],
        languageOptions: { parser: tseslint.parser, parserOptions: { sourceType: 'module' } },
        plugins: { '@typescript-eslint': tseslint.plugin },
        rules: { ...tseslint.plugin.configs.recommended.rules }
    }
]
