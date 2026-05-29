const path = require('path')
const globals = require('globals')
const allowedDependenciesPlugin = require('eslint-plugin-allowed-dependencies').default
const boundariesPlugin = require('eslint-plugin-boundaries')
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
                                'Layering rule: application must not depend on gateway or View.'
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
                                'Layering rule: core must not depend on gateway, application, or View.'
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
                                'Layering rule: infrastructure must not depend on gateway, application, core, or View.'
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
                                'Use relative imports within View to avoid ancestor barrel cycles.'
                        },
                        {
                            group: ['gateway', 'gateway/**'],
                            message: 'Consumer rule: View must not depend on gateway.'
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
    },
    {
        // SoLA 레이어 의존을 import 경로 해석으로 강제한다.
        // 위 no-restricted-imports는 alias 기반 위반만 막아, `../theaters`처럼 형제 도메인을
        // 상대경로로 참조하면 빠져나간다. boundaries는 import를 실제 파일로 해석해 element
        // 타입(레이어·도메인)을 판정하므로 상대경로 우회까지 막는다.
        files: ['src/services/**/*.ts'],
        ignores: ['src/services/**/__tests__/**'],
        plugins: { boundaries: boundariesPlugin },
        settings: {
            'boundaries/elements': [
                { mode: 'folder', pattern: 'src/services/gateway', type: 'gateway' },
                { mode: 'folder', pattern: 'src/services/view', type: 'view' },
                {
                    capture: ['domain'],
                    mode: 'folder',
                    pattern: 'src/services/application/*',
                    type: 'application'
                },
                {
                    capture: ['domain'],
                    mode: 'folder',
                    pattern: 'src/services/core/*',
                    type: 'core'
                },
                {
                    capture: ['domain'],
                    mode: 'folder',
                    pattern: 'src/services/infrastructure/*',
                    type: 'infrastructure'
                }
            ],
            'boundaries/ignore': ['**/__tests__/**'],
            'import/resolver': { typescript: { project: path.resolve(__dirname, 'tsconfig.json') } }
        },
        rules: {
            'boundaries/dependencies': [
                'warn',
                {
                    default: 'disallow',
                    rules: [
                        {
                            allow: {
                                to: {
                                    type: [
                                        'gateway',
                                        'view',
                                        'application',
                                        'core',
                                        'infrastructure'
                                    ]
                                }
                            },
                            from: { type: 'gateway' }
                        },
                        {
                            allow: {
                                to: { type: ['view', 'application', 'core', 'infrastructure'] }
                            },
                            from: { type: 'view' }
                        },
                        {
                            allow: { to: { type: ['core', 'infrastructure'] } },
                            from: { type: 'application' }
                        },
                        {
                            allow: {
                                to: {
                                    captured: { domain: '{{ from.captured.domain }}' },
                                    type: 'application'
                                }
                            },
                            from: { type: 'application' }
                        },
                        { allow: { to: { type: 'infrastructure' } }, from: { type: 'core' } },
                        {
                            allow: {
                                to: {
                                    captured: { domain: '{{ from.captured.domain }}' },
                                    type: 'core'
                                }
                            },
                            from: { type: 'core' }
                        },
                        {
                            allow: {
                                to: {
                                    captured: { domain: '{{ from.captured.domain }}' },
                                    type: 'infrastructure'
                                }
                            },
                            from: { type: 'infrastructure' }
                        }
                    ]
                }
            ]
        }
    }
]
