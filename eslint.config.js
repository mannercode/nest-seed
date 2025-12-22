const path = require('path')
const js = require('@eslint/js')
const typescriptEslintPlugin = require('@typescript-eslint/eslint-plugin')
const typescriptParser = require('@typescript-eslint/parser')
const prettierPlugin = require('eslint-plugin-prettier')
const prettierConfig = require('eslint-config-prettier')
const globals = require('globals')
const jestPlugin = require('eslint-plugin-jest')
const importPlugin = require('eslint-plugin-import')
const unusedImportsPlugin = require('eslint-plugin-unused-imports')

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
        plugins: {
            '@typescript-eslint': typescriptEslintPlugin,
            prettier: prettierPlugin,
            import: importPlugin,
            'unused-imports': unusedImportsPlugin
        },
        rules: {
            ...js.configs.recommended.rules,
            ...typescriptEslintPlugin.configs.recommended.rules,
            ...prettierConfig.rules,
            'import/order': [
                'warn',
                {
                    groups: [
                        'builtin',
                        'external',
                        'internal',
                        'parent',
                        'sibling',
                        'index',
                        'object',
                        'type'
                    ],
                    'newlines-between': 'never',
                    alphabetize: { order: 'asc', caseInsensitive: true }
                }
            ],
            'import/newline-after-import': ['warn', { count: 1 }],
            // 'import/no-extraneous-dependencies': ['warn', { devDependencies: false }],
            'prettier/prettier': 'warn',
            '@typescript-eslint/interface-name-prefix': 'off',
            '@typescript-eslint/explicit-function-return-type': 'off',
            '@typescript-eslint/explicit-module-boundary-types': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-empty-function': 'off',
            '@typescript-eslint/no-unused-vars': 'off',
            'unused-imports/no-unused-imports': 'warn',
            'unused-imports/no-unused-vars': [
                'warn',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_'
                }
            ],

            // Promise/async correctness
            '@typescript-eslint/no-floating-promises': 'warn',
            '@typescript-eslint/no-misused-promises': 'warn',
            '@typescript-eslint/await-thenable': 'warn',
            '@typescript-eslint/no-confusing-void-expression': [
                'warn',
                { ignoreArrowShorthand: true }
            ],

            // Return/await
            '@typescript-eslint/return-await': ['warn', 'in-try-catch'],
            'no-return-await': 'off',
            'require-await': 'off',

            // Null/undefined related
            '@typescript-eslint/prefer-optional-chain': 'warn',
            '@typescript-eslint/prefer-nullish-coalescing': 'warn',
            '@typescript-eslint/no-non-null-assertion': 'warn',

            // Type-aware safety
            '@typescript-eslint/consistent-type-imports': ['warn', { prefer: 'type-imports' }],
            '@typescript-eslint/no-unnecessary-condition': 'warn',
            '@typescript-eslint/no-unnecessary-type-assertion': 'warn',
            '@typescript-eslint/switch-exhaustiveness-check': 'warn',

            // Throw quality
            '@typescript-eslint/only-throw-error': 'warn',

            'no-redeclare': 'off',
            '@typescript-eslint/no-redeclare': 'warn',
            '@typescript-eslint/adjacent-overload-signatures': 'warn'
        }
    },
    {
        files: [
            'src/**/*.spec.ts',
            'src/**/*.test.ts',
            'src/**/__tests__/**/*.ts',
            'src/libs/testlib/**/*.ts',
            'src/apps/**/development.ts'
        ],
        languageOptions: { globals: { ...baseGlobals, ...testGlobals } },
        plugins: { jest: jestPlugin },
        rules: {
            'import/no-extraneous-dependencies': ['warn', { devDependencies: true }],
            'jest/no-focused-tests': 'warn',
            'jest/no-disabled-tests': 'warn',
            'jest/valid-expect': 'warn',
            'jest/no-identical-title': 'warn'
        }
    },
    {
        files: ['src/**/*.spec.ts', 'src/**/*.test.ts'],
        ignores: ['src/**/__tests__/**'],
        rules: {
            'no-restricted-syntax': [
                'error',
                { selector: 'Program', message: 'Test files must live under __tests__.' }
            ]
        }
    },
    {
        files: ['src/apps/gateway/**/*.ts'],
        rules: {
            'no-restricted-imports': [
                'warn',
                {
                    patterns: [
                        {
                            group: ['apps/gateway', 'apps/gateway/**'],
                            message:
                                'Use relative imports within gateway to avoid ancestor barrel cycles.'
                        }
                    ]
                }
            ]
        }
    },
    {
        files: ['src/apps/applications/**/*.ts'],
        rules: {
            'no-restricted-imports': [
                'warn',
                {
                    patterns: [
                        {
                            group: ['apps/applications', 'apps/applications/**'],
                            message:
                                'Use relative imports within applications to avoid ancestor barrel cycles.'
                        },
                        {
                            group: ['apps/gateway', 'apps/gateway/**'],
                            message: 'Layering rule: applications must not depend on gateway.'
                        }
                    ]
                }
            ]
        }
    },
    {
        files: ['src/apps/cores/**/*.ts'],
        rules: {
            'no-restricted-imports': [
                'warn',
                {
                    patterns: [
                        {
                            group: ['apps/cores', 'apps/cores/**'],
                            message:
                                'Use relative imports within cores to avoid ancestor barrel cycles.'
                        },
                        {
                            group: [
                                'apps/gateway',
                                'apps/gateway/**',
                                'apps/applications',
                                'apps/applications/**'
                            ],
                            message:
                                'Layering rule: cores must not depend on gateway or applications.'
                        }
                    ]
                }
            ]
        }
    },
    {
        files: ['src/apps/infrastructures/**/*.ts'],
        rules: {
            'no-restricted-imports': [
                'warn',
                {
                    patterns: [
                        {
                            group: ['apps/infrastructures', 'apps/infrastructures/**'],
                            message:
                                'Use relative imports within infrastructures to avoid ancestor barrel cycles.'
                        },
                        {
                            group: [
                                'apps/gateway',
                                'apps/gateway/**',
                                'apps/applications',
                                'apps/applications/**',
                                'apps/cores',
                                'apps/cores/**'
                            ],
                            message:
                                'Layering rule: infrastructures must not depend on gateway, applications, or cores.'
                        }
                    ]
                }
            ]
        }
    },
    {
        files: ['src/apps/shared/**/*.ts'],
        rules: {
            'no-restricted-imports': [
                'warn',
                {
                    patterns: [
                        {
                            group: ['shared', 'shared/**'],
                            message:
                                'Use relative imports within shared to avoid ancestor barrel cycles.'
                        },
                        {
                            group: [
                                'apps/gateway',
                                'apps/gateway/**',
                                'apps/applications',
                                'apps/applications/**',
                                'apps/cores',
                                'apps/cores/**',
                                'apps/infrastructures',
                                'apps/infrastructures/**'
                            ],
                            message: 'shared must not depend on app layers.'
                        }
                    ]
                }
            ]
        }
    }
]
