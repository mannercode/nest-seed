const tseslint = require('typescript-eslint')

module.exports = [
    { ignores: ['_output/**'] },
    {
        files: [
            'e2e/**/*.ts',
            'contracts/**/*.ts',
            'playwright.config.ts',
            'playwright.contract.config.ts'
        ],
        languageOptions: { parser: tseslint.parser },
        plugins: { '@typescript-eslint': tseslint.plugin },
        rules: { ...tseslint.plugin.configs.recommended.rules }
    }
]
