const path = require('path')
const { builtinModules } = require('module')
const js = require('@eslint/js')
const typescriptEslintPlugin = require('@typescript-eslint/eslint-plugin')
const typescriptParser = require('@typescript-eslint/parser')
const allowedDependenciesPlugin = require('eslint-plugin-allowed-dependencies').default
const perfectionistPlugin = require('eslint-plugin-perfectionist')
const prettierPlugin = require('eslint-plugin-prettier')
const prettierConfig = require('eslint-config-prettier')
const globals = require('globals')
const jestPlugin = require('eslint-plugin-jest')
const unusedImportsPlugin = require('eslint-plugin-unused-imports')

const escapeForRegex = value => value.replace(/[|\\{}()[\]^$+*?.-]/g, '\\$&')
const nodeBuiltinModulePattern = `^(?:node:)?(?:${[...new Set(
    builtinModules.map(moduleName => moduleName.replace(/^node:/, '').split('/')[0])
)]
    .sort()
    .map(escapeForRegex)
    .join('|')})(?:/.*)?$`
const internalAliasPattern = '^(?:apps(?:/.*)?|common|shared|testlib)$'
const dependencyIgnorePatterns = ['^\\.', nodeBuiltinModulePattern, internalAliasPattern]
const sourceDependencyOptions = {
    packageDir: __dirname,
    development: false,
    ignore: dependencyIgnorePatterns
}
const testDependencyOptions = { ...sourceDependencyOptions, development: true }

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
            allowed: allowedDependenciesPlugin,
            perfectionist: perfectionistPlugin,
            prettier: prettierPlugin,
            'unused-imports': unusedImportsPlugin
        },
        rules: {
            ...js.configs.recommended.rules,
            ...typescriptEslintPlugin.configs.recommended.rules,
            ...prettierConfig.rules,
            'func-names': 'warn',
            'no-bitwise': 'error',
            'object-shorthand': 'warn',
            'no-useless-rename': 'warn',
            'default-case-last': 'error',
            'consistent-return': 'error',
            'no-constant-condition': 'warn',
            'default-case': ['error', { commentPattern: '^no default$' }],
            'lines-around-directive': ['error', { before: 'always', after: 'always' }],
            'arrow-body-style': ['error', 'as-needed', { requireReturnForObjectLiteral: false }],
            'perfectionist/sort-imports': [
                'warn',
                {
                    type: 'unsorted',
                    order: 'asc',
                    ignoreCase: true,
                    newlinesBetween: 0,
                    internalPattern: [
                        '^apps(?:/.*)?$',
                        '^common$',
                        '^shared$',
                        '^testlib$'
                    ],
                    groups: [
                        [
                            'value-builtin',
                            'value-external',
                            'value-internal',
                            'value-parent',
                            'value-sibling',
                            'value-index',
                            'ts-equals-import'
                        ],
                        [
                            'type-builtin',
                            'type-external',
                            'type-internal',
                            'type-parent',
                            'type-sibling',
                            'type-index'
                        ],
                        'unknown'
                    ]
                }
            ],
            'padding-line-between-statements': [
                'warn',
                { blankLine: 'always', prev: 'import', next: '*' },
                { blankLine: 'any', prev: 'import', next: 'import' }
            ],
            'allowed/dependencies': ['warn', sourceDependencyOptions],
            'prettier/prettier': 'warn',
            'no-undef': 'off',
            'no-shadow': 'off',
            '@typescript-eslint/no-shadow': 'error',
            '@typescript-eslint/interface-name-prefix': 'off',
            '@typescript-eslint/explicit-function-return-type': 'off',
            '@typescript-eslint/explicit-module-boundary-types': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-empty-function': 'off',
            '@typescript-eslint/no-empty-object-type': 'off',
            '@typescript-eslint/no-unused-vars': [
                'warn',
                {
                    args: 'all',
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_'
                }
            ],
            'unused-imports/no-unused-imports': 'warn',
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
            'src/**/__tests__/**/*.ts',
            'src/libs/testlib/**/*.ts',
            'src/apps/**/development.ts'
        ],
        languageOptions: { globals: { ...baseGlobals, ...testGlobals } },
        plugins: { jest: jestPlugin },
        rules: {
            'allowed/dependencies': ['warn', testDependencyOptions],
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
