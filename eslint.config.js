const { builtinModules } = require('module')
const tseslint = require('typescript-eslint')
const allowedDependenciesPlugin = require('eslint-plugin-allowed-dependencies').default
const perfectionistPlugin = require('eslint-plugin-perfectionist')
const globals = require('globals')
const jestPlugin = require('eslint-plugin-jest')
const unusedImportsPlugin = require('eslint-plugin-unused-imports')

const escapeForRegex = (value) => value.replace(/[|\\{}()[\]^$+*?.-]/g, '\\$&')
const nodeBuiltinModulePattern = `^(?:node:)?(?:${[
    ...new Set(builtinModules.map((moduleName) => moduleName.replace(/^node:/, '').split('/')[0]))
]
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

module.exports = [
    {
        files: ['src/**/*.ts'],
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
        plugins: {
            '@typescript-eslint': tseslint.plugin,
            allowed: allowedDependenciesPlugin,
            perfectionist: perfectionistPlugin,
            'unused-imports': unusedImportsPlugin
        },
        rules: {
            ...tseslint.plugin.configs.recommended.rules,
            ...{
                '@typescript-eslint/no-floating-promises': 'warn',
                '@typescript-eslint/no-misused-promises': 'warn',
                '@typescript-eslint/await-thenable': 'warn',
                '@typescript-eslint/no-confusing-void-expression': [
                    'warn',
                    { ignoreArrowShorthand: true }
                ],
                '@typescript-eslint/return-await': ['warn', 'in-try-catch'],
                '@typescript-eslint/prefer-optional-chain': 'warn',
                '@typescript-eslint/prefer-nullish-coalescing': 'warn',
                '@typescript-eslint/no-unnecessary-condition': 'warn',
                '@typescript-eslint/no-unnecessary-type-assertion': 'warn',
                '@typescript-eslint/switch-exhaustiveness-check': 'warn',
                '@typescript-eslint/only-throw-error': 'warn'
            },
            'object-shorthand': 'warn',
            'no-useless-rename': 'warn',
            'arrow-body-style': ['warn', 'as-needed', { requireReturnForObjectLiteral: false }],
            'perfectionist/sort-imports': [
                'warn',
                { type: 'natural', order: 'asc', newlinesBetween: 0 }
            ],
            'perfectionist/sort-exports': [
                'warn',
                { type: 'natural', order: 'asc', newlinesBetween: 0 }
            ],
            'no-bitwise': 'error',
            'consistent-return': 'error',
            'no-constant-condition': 'warn',
            'default-case': 'off',
            'allowed/dependencies': ['warn', sourceDependencyOptions],
            '@typescript-eslint/no-shadow': 'error',
            '@typescript-eslint/explicit-function-return-type': 'off',
            '@typescript-eslint/explicit-module-boundary-types': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-empty-function': 'off',
            '@typescript-eslint/no-empty-object-type': 'off',
            '@typescript-eslint/no-unused-vars': 'off',
            'unused-imports/no-unused-imports': 'warn',
            'unused-imports/no-unused-vars': [
                'warn',
                {
                    args: 'all',
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_'
                }
            ],
            '@typescript-eslint/no-non-null-assertion': 'warn',
            '@typescript-eslint/consistent-type-imports': ['warn', { prefer: 'type-imports' }],
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
        languageOptions: { globals: { ...baseGlobals, ...globals.jest } },
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
