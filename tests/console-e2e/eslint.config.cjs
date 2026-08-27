const tseslint = require('typescript-eslint')

module.exports = [
    { ignores: ['_output/**'] },
    {
        files: [
            'tests/**/*.ts',
            'unit/**/*.ts',
            'playwright.config.ts',
            'playwright.unit.config.ts'
        ],
        languageOptions: { parser: tseslint.parser },
        plugins: { '@typescript-eslint': tseslint.plugin },
        rules: { ...tseslint.plugin.configs.recommended.rules }
    }
]
