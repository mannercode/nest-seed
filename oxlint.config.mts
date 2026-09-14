import { builtinModules } from 'node:module'
import { resolve } from 'node:path'
import { defineConfig } from 'oxlint'

const apiDir = resolve(import.meta.dirname, 'apps/api')
const layers = ['gateway', 'view', 'application', 'core', 'infrastructure']
const domainLayers = ['application', 'core', 'infrastructure']
const layerTypes = (layer: string) => [layer, `${layer}-barrel`]
const nodeBuiltinModules = [
    ...new Set(builtinModules.map((name) => name.replace(/^node:/, '').split('/')[0]))
]
const apiDependencyOptions = {
    packageDir: apiDir,
    development: false,
    ignore: [
        '^\\.',
        `^(?:node:)?(?:${nodeBuiltinModules.join('|')})(?:/.*)?$`,
        `^#(?:${[...layers, 'config'].join('|')})(?:/.*)?$`,
        '^@mannercode/'
    ]
}
const integrationImports = [
    'mongodb',
    'mongodb/**',
    'ioredis',
    'ioredis/**',
    'bcrypt',
    'bcrypt/**',
    '@nestjs/jwt',
    '@nestjs/jwt/**',
    '@nats-io/**',
    '@restatedev/**',
    '@aws-sdk/**'
]
const integrationImportRestrictions = [
    {
        group: integrationImports,
        message: '외부 연동은 @mannercode/common의 공개 API를 사용하세요.'
    },
    {
        group: ['@mannercode/common'],
        importNames: [
            'MongoObjectId',
            'StoredDocument',
            'objectId',
            'objectIds',
            'newObjectId',
            'encodeMongoFilter',
            'encodeMongoUpdate',
            'mongoToPublic',
            'mongoArrayToPublic'
        ],
        message: '문서 ID는 문자열로 사용하고 ObjectId 변환은 common Repository에 맡기세요.'
    }
]
const internalImportRestrictions = [
    {
        regex: '(?:^|/)showtime-creation/(?:internal|worker)(?:/|$)',
        message:
            'showtime-creation의 internal/worker는 공개 API가 아닙니다. 외부 운영 코드는 #application을 사용하세요.'
    }
]

export default defineConfig({
    // ESLint에서는 검사했지만 현재 Oxlint 구성으로 대체하지 못한 안전장치다.
    // - TypeScript 7 + oxlint-tsgolint가 필요한 promise 처리, exhaustive switch,
    //   consistent return, 불필요한 조건·타입 단언 등의 타입 기반 검사
    // - enum·테스트 위치 등을 제한하던 범용 AST selector와 Perfectionist식 import/export 정렬
    plugins: ['typescript', 'unicorn', 'oxc'],
    jsPlugins: ['eslint-plugin-boundaries', 'eslint-plugin-allowed-dependencies'],
    categories: { correctness: 'error' },

    settings: {
        // workspace lint와 루트의 lint-staged가 같은 소스 파일을 해석해야 한다.
        'boundaries/root-path': apiDir,
        'boundaries/include': ['src/services/**/*.ts'],
        'boundaries/ignore': ['**/__tests__/**'],
        'boundaries/flag-as-external': { unresolvableAlias: false },
        'boundaries/additional-dependency-nodes': [
            { selector: 'TSImportType > Literal', kind: 'type', name: 'import' },
            { selector: 'TSExternalModuleReference > Literal', kind: 'value', name: 'require' }
        ],
        'boundaries/elements': [
            { type: 'gateway', pattern: 'src/services/gateway' },
            { type: 'view', pattern: 'src/services/view/*/*', capture: ['client', 'domain'] },
            ...domainLayers.map((layer) => ({
                type: layer,
                pattern: `src/services/${layer}/*`,
                capture: ['domain']
            })),
            // 계층 barrel은 공개 API를 모으지만, 도메인이 자기 계층 barrel을 참조하면 순환한다.
            ...layers
                .filter((layer) => layer !== 'gateway')
                .map((layer) => ({ type: `${layer}-barrel`, pattern: `src/services/${layer}` }))
        ],
        'import/resolver': { typescript: { project: resolve(apiDir, 'tsconfig.json') } }
    },

    rules: { 'typescript/no-explicit-any': 'off' },
    env: { node: true },
    ignorePatterns: ['_todo/**', '**/_output/**', '**/.next/**', '**/coverage/**'],
    overrides: [
        {
            files: ['apps/api/{src,scripts}/**/*.ts'],
            rules: { 'allowed-dependencies/dependencies': ['error', apiDependencyOptions] }
        },
        {
            files: ['apps/api/src/**/__tests__/**/*.ts'],
            // 루트에서 켜면 correctness 분류의 다른 Vitest 규칙까지 활성화된다.
            plugins: ['typescript', 'unicorn', 'oxc', 'vitest'],
            rules: {
                'allowed-dependencies/dependencies': [
                    'error',
                    { ...apiDependencyOptions, development: true }
                ],
                'vitest/no-focused-tests': 'error',
                'vitest/no-disabled-tests': 'error',
                'vitest/valid-expect': 'error',
                'vitest/no-identical-title': 'error'
            }
        },
        {
            files: ['apps/api/src/services/**/*.ts'],
            excludeFiles: ['apps/api/src/**/__tests__/**/*.ts'],
            rules: {
                'boundaries/no-unknown-files': 'error',
                'boundaries/no-unknown-dependencies': 'error',
                'boundaries/dependencies': [
                    'error',
                    {
                        default: 'disallow',
                        policies: [
                            ...layers
                                .slice(0, -1)
                                .map((layer, index) => ({
                                    from: { element: { type: layerTypes(layer) } },
                                    allow: {
                                        to: {
                                            element: {
                                                type: layers.slice(index + 1).flatMap(layerTypes),
                                                fileInternalPath: 'index.ts'
                                            }
                                        }
                                    }
                                })),
                            ...layers
                                .filter((layer) => layer !== 'gateway')
                                .map((layer) => ({
                                    from: { element: { type: `${layer}-barrel` } },
                                    allow: {
                                        to: {
                                            element: { type: layer, fileInternalPath: 'index.ts' }
                                        }
                                    }
                                }))
                        ]
                    }
                ]
            }
        },
        {
            files: ['apps/api/src/**/*.ts'],
            excludeFiles: ['apps/api/src/**/__tests__/**/*.ts'],
            rules: {
                'no-restricted-imports': [
                    'error',
                    { patterns: [...internalImportRestrictions, ...integrationImportRestrictions] }
                ]
            }
        },
        {
            files: ['apps/api/src/services/**/*.ts'],
            excludeFiles: ['apps/api/src/**/__tests__/**/*.ts', '**/*.repository.ts'],
            rules: {
                'no-restricted-imports': [
                    'error',
                    {
                        patterns: [
                            ...internalImportRestrictions,
                            ...integrationImportRestrictions,
                            {
                                group: ['@mannercode/common'],
                                importNames: [
                                    'isDuplicateKeyError',
                                    'MongoTransactionRepository',
                                    'MongoConnection'
                                ],
                                message:
                                    'MongoDB 오류 판별과 세션 관리는 Repository에서 처리하세요.'
                            }
                        ]
                    }
                ]
            }
        },
        {
            files: [
                'apps/api/src/**/__tests__/**/*.{spec,test,fixture}.ts',
                'libs/*/src/**/__tests__/**/*.{spec,test,fixture}.ts'
            ],
            rules: {
                'no-restricted-imports': [
                    'error',
                    {
                        patterns: [
                            {
                                group: [
                                    '../*.js',
                                    '../**/*.js',
                                    '!../index.js',
                                    '!../**/index.js',
                                    // 공개 API가 아닌 구현 단위 테스트에서만 허용하는 직접 import다.
                                    '!../booking.utils.js',
                                    '!../../services/core/movies/movies.repository.js',
                                    '!../../services/core/movies/movie-pending-assets.repository.js',
                                    '!../../services/core/purchase-records/purchase-records.repository.js',
                                    '!../../services/core/tickets/tickets.repository.js',
                                    '!../../services/infrastructure/payments/payments.repository.js'
                                ],
                                message:
                                    '공개 항목은 해당 모듈의 index.js에서 가져오세요. 비공개 구현 테스트는 oxlint.config.mts의 명시적 허용 목록에 추가하세요.'
                            }
                        ]
                    }
                ]
            }
        },
        {
            files: ['apps/{console,user-app}/src/**/*.{ts,tsx}'],
            plugins: ['jsx-a11y', 'nextjs', 'react'],
            rules: {
                'react/rules-of-hooks': 'error',
                'jsx-a11y/alt-text': 'error',
                'nextjs/no-img-element': 'error'
            },
            env: { browser: true, node: true }
        },
        {
            files: ['libs/common/src/utils/__tests__/byte.spec.ts'],
            rules: { 'oxc/number-arg-out-of-range': 'off' }
        },
        {
            files: ['apps/api/src/__tests__/application/purchase-events.spec.ts'],
            rules: { 'require-yield': 'off' }
        }
    ]
})
