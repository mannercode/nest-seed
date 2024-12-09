const path = require('path')
const typescriptEslintPlugin = require('@typescript-eslint/eslint-plugin')
const typescriptParser = require('@typescript-eslint/parser')
const prettierPlugin = require('eslint-plugin-prettier')
const prettierConfig = require('eslint-config-prettier')

module.exports = [
    {
        files: ['src/app/**/*.ts', 'src/libs/common/**/*.ts'],
        languageOptions: {
            parser: typescriptParser,
            parserOptions: {
                project: path.resolve(__dirname, './tsconfig.json'),
                tsconfigRootDir: __dirname,
                sourceType: 'module'
            },
            globals: {
                module: 'readonly',
                require: 'readonly',
                describe: 'readonly',
                it: 'readonly',
                expect: 'readonly'
            }
        },
        plugins: { '@typescript-eslint': typescriptEslintPlugin, prettier: prettierPlugin },
        rules: {
            ...typescriptEslintPlugin.configs.recommended.rules,
            ...prettierConfig.rules,
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
            ]
        }
    }
]
