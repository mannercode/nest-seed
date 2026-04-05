const { tseslint, baseGlobals, basePlugins, baseRules } = require('../eslint.config.base')

module.exports = [
    {
        files: ['*/src/**/*.ts'],
        linterOptions: { reportUnusedDisableDirectives: true },
        languageOptions: {
            parser: tseslint.parser,
            parserOptions: {
                sourceType: 'module',
                projectService: true,
                tsconfigRootDir: __dirname
            },
            globals: { ...baseGlobals }
        },
        plugins: { ...basePlugins },
        rules: { ...baseRules }
    },
    {
        files: ['*/src/**/__tests__/**/*.ts'],
        languageOptions: { globals: { ...baseGlobals, ...require('globals').jest } },
        rules: {}
    },
    {
        files: ['*/src/**/*.spec.ts', '*/src/**/*.test.ts'],
        ignores: ['*/src/**/__tests__/**'],
        rules: {
            'no-restricted-syntax': [
                'error',
                { selector: 'Program', message: 'Test files must live under __tests__.' }
            ]
        }
    }
]
