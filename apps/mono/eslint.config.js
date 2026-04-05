const { builtinModules } = require('module')
const globals = require('globals')
const allowedDependenciesPlugin = require('eslint-plugin-allowed-dependencies').default
const jestPlugin = require('eslint-plugin-jest')
const {
    tseslint,
    baseGlobals,
    basePlugins,
    baseRules,
    barrelImportPatterns
} = require('../../eslint.config.base')

const escapeForRegex = (value) => value.replace(/[|\\{}()[\]^$+*?.-]/g, '\\$&')
const nodeBuiltinModulePattern = `^(?:node:)?(?:${[
    ...new Set(builtinModules.map((moduleName) => moduleName.replace(/^node:/, '').split('/')[0]))
]
    .sort()
    .map(escapeForRegex)
    .join('|')})(?:/.*)?$`
const internalAliasPattern = '^(?:applications|controllers|cores|infrastructures|config)$'
const dependencyIgnorePatterns = [
    '^\\.',
    nodeBuiltinModulePattern,
    internalAliasPattern,
    '^@mannercode/'
]
const sourceDependencyOptions = {
    packageDir: __dirname,
    development: false,
    ignore: dependencyIgnorePatterns
}
const testDependencyOptions = { ...sourceDependencyOptions, development: true }

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
        plugins: { ...basePlugins, allowed: allowedDependenciesPlugin },
        rules: {
            ...baseRules,
            'default-case': 'off',
            'allowed/dependencies': ['warn', sourceDependencyOptions]
        }
    },
    {
        files: ['src/**/__tests__/**/*.ts', 'src/development.ts'],
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
        files: ['src/controllers/**/*.ts'],
        rules: {
            'no-restricted-imports': [
                'warn',
                {
                    patterns: [
                        ...barrelImportPatterns,
                        {
                            group: ['controllers', 'controllers/**'],
                            message:
                                'Use relative imports within controllers to avoid ancestor barrel cycles.'
                        }
                    ]
                }
            ]
        }
    },
    {
        files: ['src/applications/**/*.ts'],
        rules: {
            'no-restricted-imports': [
                'warn',
                {
                    patterns: [
                        ...barrelImportPatterns,
                        {
                            group: ['applications', 'applications/**'],
                            message:
                                'Use relative imports within applications to avoid ancestor barrel cycles.'
                        },
                        {
                            group: ['controllers', 'controllers/**'],
                            message: 'Layering rule: applications must not depend on controllers.'
                        }
                    ]
                }
            ]
        }
    },
    {
        files: ['src/cores/**/*.ts'],
        rules: {
            'no-restricted-imports': [
                'warn',
                {
                    patterns: [
                        ...barrelImportPatterns,
                        {
                            group: ['cores', 'cores/**'],
                            message:
                                'Use relative imports within cores to avoid ancestor barrel cycles.'
                        },
                        {
                            group: [
                                'controllers',
                                'controllers/**',
                                'applications',
                                'applications/**'
                            ],
                            message:
                                'Layering rule: cores must not depend on controllers or applications.'
                        }
                    ]
                }
            ]
        }
    },
    {
        files: ['src/infrastructures/**/*.ts'],
        rules: {
            'no-restricted-imports': [
                'warn',
                {
                    patterns: [
                        ...barrelImportPatterns,
                        {
                            group: ['infrastructures', 'infrastructures/**'],
                            message:
                                'Use relative imports within infrastructures to avoid ancestor barrel cycles.'
                        },
                        {
                            group: [
                                'controllers',
                                'controllers/**',
                                'applications',
                                'applications/**',
                                'cores',
                                'cores/**'
                            ],
                            message:
                                'Layering rule: infrastructures must not depend on controllers, applications, or cores.'
                        }
                    ]
                }
            ]
        }
    },
    {
        files: ['src/config/**/*.ts'],
        rules: {
            'no-restricted-imports': [
                'warn',
                {
                    patterns: [
                        ...barrelImportPatterns,
                        {
                            regex: '^config(/.*)?$',
                            message:
                                'Use relative imports within config to avoid ancestor barrel cycles.'
                        },
                        {
                            group: [
                                'controllers',
                                'controllers/**',
                                'applications',
                                'applications/**',
                                'cores',
                                'cores/**',
                                'infrastructures',
                                'infrastructures/**'
                            ],
                            message: 'config must not depend on app layers.'
                        }
                    ]
                }
            ]
        }
    }
]
