const js = require('@eslint/js')
const globals = require('globals')

module.exports = [
    {
        files: ['*.js', '__tests__/*.test.js'],
        languageOptions: { ecmaVersion: 'latest', sourceType: 'commonjs', globals: globals.node },
        rules: {
            ...js.configs.recommended.rules,
            'no-unused-vars': [
                'error',
                {
                    args: 'all',
                    argsIgnorePattern: '^_',
                    caughtErrors: 'all',
                    caughtErrorsIgnorePattern: '^_'
                }
            ]
        }
    }
]
