const globals = require('globals')
const allowedDependenciesPlugin = require('eslint-plugin-allowed-dependencies').default
const jestPlugin = require('eslint-plugin-jest')
const {
    baseGlobals,
    barrelImportPatterns,
    nodeBuiltinModulePattern,
    createBaseConfigs
} = require('../../eslint.config.node')

const internalAliasPattern = '^(?:application|gateway|core|infrastructure|config|view)$'
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
    ...createBaseConfigs({
        tsconfigRootDir: __dirname,
        srcGlob: '{src,scripts}/**',
        parserOptions: { project: ['./tsconfig.json', './tsconfig.jest.json'] }
    }),
    {
        files: ['src/**/*.ts', 'scripts/**/*.ts'],
        plugins: { allowed: allowedDependenciesPlugin },
        rules: { 'default-case': 'off', 'allowed/dependencies': ['warn', sourceDependencyOptions] }
    },
    { files: ['scripts/**/*.ts'], rules: { 'no-restricted-imports': 'off' } },
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
        files: ['src/services/gateway/**/*.ts'],
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
        files: ['src/services/application/**/*.ts'],
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
                            group: ['gateway', 'gateway/**', 'view', 'view/**'],
                            message:
                                'Layering rule: application must not depend on gateway or view.'
                        }
                    ]
                }
            ]
        }
    },
    {
        files: ['src/services/core/**/*.ts'],
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
                                'application/**',
                                'view',
                                'view/**'
                            ],
                            message:
                                'Layering rule: core must not depend on gateway, application, or view.'
                        }
                    ]
                }
            ]
        }
    },
    {
        files: ['src/services/infrastructure/**/*.ts'],
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
                                'core/**',
                                'view',
                                'view/**'
                            ],
                            message:
                                'Layering rule: infrastructure must not depend on gateway, application, core, or view.'
                        }
                    ]
                }
            ]
        }
    },
    {
        files: ['src/services/view/**/*.ts'],
        rules: {
            'no-restricted-imports': [
                'warn',
                {
                    patterns: [
                        ...barrelImportPatterns,
                        {
                            group: ['view', 'view/**'],
                            message:
                                'Use relative imports within view to avoid ancestor barrel cycles.'
                        },
                        {
                            group: [
                                'gateway',
                                'gateway/**',
                                'application',
                                'application/**',
                                'infrastructure',
                                'infrastructure/**'
                            ],
                            message:
                                'Layering rule: view is a read model layer and must not depend on gateway, application, or infrastructure.'
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
                                'gateway',
                                'gateway/**',
                                'application',
                                'application/**',
                                'core',
                                'core/**',
                                'infrastructure',
                                'infrastructure/**',
                                'view',
                                'view/**'
                            ],
                            message: 'config must not depend on app layers.'
                        }
                    ]
                }
            ]
        }
    },
    {
        files: ['src/modules/**/*.ts'],
        rules: {
            'no-restricted-imports': [
                'warn',
                {
                    patterns: [
                        ...barrelImportPatterns,
                        {
                            group: [
                                'gateway',
                                'gateway/**',
                                'application',
                                'application/**',
                                'core',
                                'core/**',
                                'infrastructure',
                                'infrastructure/**',
                                'view',
                                'view/**'
                            ],
                            message: 'modules must not depend on app layers.'
                        }
                    ]
                }
            ]
        }
    }
]
