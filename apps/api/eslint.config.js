const globals = require('globals')
const allowedDependenciesPlugin = require('eslint-plugin-allowed-dependencies').default
const jestPlugin = require('eslint-plugin-jest')
const {
    baseGlobals,
    barrelImportPatterns,
    nodeBuiltinModulePattern,
    createBaseConfigs
} = require('../../eslint.config.base')

const internalAliasPattern = '^(?:application|gateway|core|infrastructure|shared)$'
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
    ...createBaseConfigs({ tsconfigRootDir: __dirname }),
    {
        files: ['src/**/*.ts'],
        plugins: { allowed: allowedDependenciesPlugin },
        rules: {
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
        files: ['src/gateway/**/*.ts'],
        rules: {
            'no-restricted-imports': [
                'warn',
                {
                    patterns: [
                        ...barrelImportPatterns,
                        {
                            group: ['gateway', 'gateway/**'],
                            message:
                                'Use relative imports within gateway to avoid ancestor barrel cycles.'
                        }
                    ]
                }
            ]
        }
    },
    {
        files: ['src/application/**/*.ts'],
        rules: {
            'no-restricted-imports': [
                'warn',
                {
                    patterns: [
                        ...barrelImportPatterns,
                        {
                            group: ['application', 'application/**'],
                            message:
                                'Use relative imports within application to avoid ancestor barrel cycles.'
                        },
                        {
                            group: ['gateway', 'gateway/**'],
                            message: 'Layering rule: application must not depend on gateway.'
                        }
                    ]
                }
            ]
        }
    },
    {
        files: ['src/core/**/*.ts'],
        rules: {
            'no-restricted-imports': [
                'warn',
                {
                    patterns: [
                        ...barrelImportPatterns,
                        {
                            group: ['core', 'core/**'],
                            message:
                                'Use relative imports within core to avoid ancestor barrel cycles.'
                        },
                        {
                            group: [
                                'gateway',
                                'gateway/**',
                                'application',
                                'application/**'
                            ],
                            message:
                                'Layering rule: core must not depend on gateway or application.'
                        }
                    ]
                }
            ]
        }
    },
    {
        files: ['src/infrastructure/**/*.ts'],
        rules: {
            'no-restricted-imports': [
                'warn',
                {
                    patterns: [
                        ...barrelImportPatterns,
                        {
                            group: ['infrastructure', 'infrastructure/**'],
                            message:
                                'Use relative imports within infrastructure to avoid ancestor barrel cycles.'
                        },
                        {
                            group: [
                                'gateway',
                                'gateway/**',
                                'application',
                                'application/**',
                                'core',
                                'core/**'
                            ],
                            message:
                                'Layering rule: infrastructure must not depend on gateway, application, or core.'
                        }
                    ]
                }
            ]
        }
    },
    {
        files: ['src/shared/**/*.ts'],
        rules: {
            'no-restricted-imports': [
                'warn',
                {
                    patterns: [
                        ...barrelImportPatterns,
                        {
                            regex: '^shared(/.*)?$',
                            message:
                                'Use relative imports within shared to avoid ancestor barrel cycles.'
                        },
                        {
                            group: [
                                'gateway',
                                'gateway/**',
                                'application',
                                'application/**',
                                'core',
                                'core/**',
                                'infrastructure',
                                'infrastructure/**'
                            ],
                            message: 'shared must not depend on app layers.'
                        }
                    ]
                }
            ]
        }
    }
]
