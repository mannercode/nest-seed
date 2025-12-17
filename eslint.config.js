// eslint.config.js (Flat Config)
const path = require('path')
const js = require('@eslint/js')
const typescriptEslintPlugin = require('@typescript-eslint/eslint-plugin')
const typescriptParser = require('@typescript-eslint/parser')
const prettierPlugin = require('eslint-plugin-prettier')
const prettierConfig = require('eslint-config-prettier')
const globals = require('globals')
const jestPlugin = require('eslint-plugin-jest')

const baseGlobals = { ...globals.node, ...globals.es2021, module: 'readonly', require: 'readonly' }
const testGlobals = {
    describe: 'readonly',
    it: 'readonly',
    expect: 'readonly',
    jest: 'readonly',
    beforeAll: 'readonly',
    afterAll: 'readonly',
    beforeEach: 'readonly',
    afterEach: 'readonly'
}

module.exports = [
    { ignores: ['dist/**', 'node_modules/**'] },
    {
        files: ['src/**/*.ts'],
        linterOptions: { reportUnusedDisableDirectives: true },
        languageOptions: {
            parser: typescriptParser,
            parserOptions: {
                project: path.resolve(__dirname, './tsconfig.json'),
                tsconfigRootDir: __dirname,
                sourceType: 'module'
            },
            globals: { ...baseGlobals }
        },
        plugins: { '@typescript-eslint': typescriptEslintPlugin, prettier: prettierPlugin },
        rules: {
            ...js.configs.recommended.rules,
            ...typescriptEslintPlugin.configs.recommended.rules,
            ...prettierConfig.rules,

            'prettier/prettier': 'error',
            '@typescript-eslint/interface-name-prefix': 'off',
            '@typescript-eslint/explicit-function-return-type': 'off',
            '@typescript-eslint/explicit-module-boundary-types': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-empty-function': 'off',
            '@typescript-eslint/no-unused-vars': [
                'warn',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_'
                }
            ],

            // Promise/async correctness
            '@typescript-eslint/no-floating-promises': 'error',
            '@typescript-eslint/no-misused-promises': 'error',
            '@typescript-eslint/await-thenable': 'error',
            '@typescript-eslint/no-confusing-void-expression': [
                'error',
                { ignoreArrowShorthand: true }
            ],

            // Return/await
            '@typescript-eslint/return-await': ['error', 'in-try-catch'],
            'no-return-await': 'off',
            'require-await': 'off',

            // Null/undefined related
            '@typescript-eslint/prefer-optional-chain': 'warn',
            '@typescript-eslint/prefer-nullish-coalescing': 'warn',
            '@typescript-eslint/no-non-null-assertion': 'warn',

            // Type-aware safety
            '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
            '@typescript-eslint/no-unnecessary-condition': 'warn',
            '@typescript-eslint/no-unnecessary-type-assertion': 'warn',
            '@typescript-eslint/switch-exhaustiveness-check': 'error',

            // Throw quality
            '@typescript-eslint/only-throw-error': 'error',

            'no-redeclare': 'off',
            '@typescript-eslint/no-redeclare': 'error',
            '@typescript-eslint/adjacent-overload-signatures': 'error'
        }
    },
    {
        files: ['**/*.spec.ts', '**/*.test.ts', '**/__tests__/**/*.ts', 'src/libs/testlib/**/*.ts'],
        languageOptions: { globals: { ...baseGlobals, ...testGlobals } },
        plugins: { ...(jestPlugin ? { jest: jestPlugin } : {}) },
        rules: {
            ...(jestPlugin
                ? {
                      'jest/no-focused-tests': 'error',
                      'jest/no-disabled-tests': 'warn',
                      'jest/valid-expect': 'error',
                      'jest/no-identical-title': 'error'
                  }
                : {})
        }
    }
]
