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

// SoLA 레이어. 앞이 상위 레이어 — 각 레이어는 자기보다 뒤에 오는 레이어만 import할 수 있다.
const layers = ['gateway', 'view', 'application', 'core', 'infrastructure']
// 도메인 폴더로 분할된 레이어. 같은 레이어 안에서는 같은 도메인만 참조할 수 있다.
const domainLayers = ['application', 'core', 'infrastructure']

// no-restricted-imports의 group 패턴은 gitignore 방식이라 슬래시 없는 패턴이 경로 어느 깊이에서나 매치된다.
// `config` 패턴이 `@nestjs/config`까지 잡는 오탐이 생기므로, alias 제한은 시작을 고정한 regex로 선언한다.
const aliasRegex = (...aliases) => `^(?:${aliases.join('|')})(/.*)?$`

const internalAliasPattern = aliasRegex(...layers, 'config')
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

// 레이어별 alias import 제한을 layers 순서에서 유도한다.
// no-restricted-imports를 override하면 base 옵션이 통째로 교체되므로 barrel 패턴을 매번 다시 포함한다.
const layerImportBlocks = layers.map((layer, index) => {
    const upperLayers = layers.slice(0, index)
    const patterns = [
        ...barrelImportPatterns,
        {
            regex: aliasRegex(layer),
            message: `Use relative imports within ${layer} to avoid ancestor barrel cycles.`
        }
    ]
    if (upperLayers.length > 0) {
        patterns.push({
            regex: aliasRegex(...upperLayers),
            message: `Layering rule: ${layer} must not depend on ${upperLayers.join(', ')}.`
        })
    }
    return {
        files: [`src/services/${layer}/**/*.ts`],
        rules: { 'no-restricted-imports': ['warn', { patterns }] }
    }
})

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
    ...layerImportBlocks,
    {
        files: ['src/config/**/*.ts'],
        rules: {
            'no-restricted-imports': [
                'warn',
                {
                    patterns: [
                        ...barrelImportPatterns,
                        {
                            regex: aliasRegex('config'),
                            message:
                                'Use relative imports within config to avoid ancestor barrel cycles.'
                        },
                        {
                            regex: aliasRegex(...layers),
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
                            regex: aliasRegex(...layers),
                            message: 'modules must not depend on app layers.'
                        }
                    ]
                }
            ]
        }
    },
    {
        // SoLA 레이어 의존을 import 경로 해석으로 강제한다.
        // 위 no-restricted-imports는 alias 기반 위반만 막아, `../theaters`처럼 형제 도메인을 상대경로로 참조하면 빠져나간다.
        // boundaries는 import를 실제 파일로 해석해 element 타입(레이어·도메인)을 판정하므로 상대경로 우회까지 막는다.
        files: ['src/services/**/*.ts'],
        ignores: ['src/services/**/__tests__/**'],
        plugins: { boundaries: boundariesPlugin },
        settings: {
            'boundaries/elements': layers.map((layer) =>
                domainLayers.includes(layer)
                    ? {
                          capture: ['domain'],
                          mode: 'folder',
                          pattern: `src/services/${layer}/*`,
                          type: layer
                      }
                    : { mode: 'folder', pattern: `src/services/${layer}`, type: layer }
            ),
            'boundaries/ignore': ['**/__tests__/**'],
            'import/resolver': { typescript: { project: path.resolve(__dirname, 'tsconfig.json') } }
        },
        rules: {
            'boundaries/dependencies': [
                'warn',
                {
                    default: 'disallow',
                    // 하위 레이어는 도메인 무관하게 허용하고, 같은 레이어는 같은 도메인만 허용한다.
                    // 같은 element 내부 import는 boundaries가 검사하지 않으므로
                    // 단일 element인 gateway·view는 자기 자신 허용 규칙이 필요 없다.
                    rules: layers.flatMap((layer, index) => {
                        const lowerLayers = layers.slice(index + 1)
                        const layerRules = []
                        if (lowerLayers.length > 0) {
                            layerRules.push({
                                allow: { to: { type: lowerLayers } },
                                from: { type: layer }
                            })
                        }
                        if (domainLayers.includes(layer)) {
                            layerRules.push({
                                allow: {
                                    to: {
                                        captured: { domain: '{{ from.captured.domain }}' },
                                        type: layer
                                    }
                                },
                                from: { type: layer }
                            })
                        }
                        return layerRules
                    })
                }
            ]
        }
    }
]
