const globals = require('globals')
const allowedDependenciesPlugin = require('eslint-plugin-allowed-dependencies').default
const jestPlugin = require('eslint-plugin-jest')
const {
    baseGlobals,
    barrelImportPatterns,
    nodeBuiltinModulePattern,
    createBaseConfigs
} = require('../../eslint.config.base')

const internalAliasPattern = '^(?:applications|gateway|cores|infrastructures|config)$'
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
                            group: ['gateway', 'gateway/**'],
                            message: 'Layering rule: applications must not depend on gateway.'
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
                                'gateway',
                                'gateway/**',
                                'applications',
                                'applications/**'
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
                                'gateway',
                                'gateway/**',
                                'applications',
                                'applications/**',
                                'cores',
                                'cores/**'
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
