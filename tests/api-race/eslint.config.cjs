const js = require('@eslint/js')
const globals = require('globals')

module.exports = [
    {
        files: ['*.js', 'contracts/*.test.js', 'probes/*.js'],
        languageOptions: { sourceType: 'commonjs', globals: globals.node },
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
