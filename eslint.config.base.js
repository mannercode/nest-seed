const { builtinModules } = require('module')
const tseslint = require('typescript-eslint')
const perfectionistPlugin = require('eslint-plugin-perfectionist')
const globals = require('globals')
const unusedImportsPlugin = require('eslint-plugin-unused-imports')

const baseGlobals = { ...globals.node, ...globals.es2025, module: 'readonly', require: 'readonly' }
const barrelImportPatterns = [
    {
        regex: '\\.\\./(?!\\.)[^/]+/[^/]+',
        message: 'Import from the barrel (index.ts) instead of submodules.'
    }
]
const restrictedSyntaxBase = [
    {
        selector: 'TSEnumDeclaration',
        message: 'Use an `as const` object + same-named type alias instead of `enum`.'
    }
]

const escapeForRegex = (value) => value.replace(/[|\\{}()[\]^$+*?.-]/g, '\\$&')

/**
 * allowed-dependencies 규칙은 import 문자열을 정규식으로 검사한다. Node.js
 * 내장 모듈은 `fs`, `node:fs/promises`처럼 표기 방식이 섞여 있으므로, 접두사와
 * 하위 경로를 모두 허용하는 패턴을 미리 만든다.
 */
const nodeBuiltinModulePattern = `^(?:node:)?(?:${[
    ...new Set(builtinModules.map((moduleName) => moduleName.replace(/^node:/, '').split('/')[0]))
]
    .sort()
    .map(escapeForRegex)
    .join('|')})(?:/.*)?$`
const basePlugins = {
    '@typescript-eslint': tseslint.plugin,
    perfectionist: perfectionistPlugin,
    'unused-imports': unusedImportsPlugin
}
const baseRules = {
    ...tseslint.plugin.configs.recommended.rules,
    '@typescript-eslint/no-floating-promises': 'warn',
    '@typescript-eslint/no-misused-promises': 'warn',
    '@typescript-eslint/await-thenable': 'warn',
    '@typescript-eslint/no-confusing-void-expression': ['warn', { ignoreArrowShorthand: true }],
    '@typescript-eslint/return-await': ['warn', 'in-try-catch'],
    '@typescript-eslint/prefer-optional-chain': 'warn',
    '@typescript-eslint/prefer-nullish-coalescing': 'warn',
    '@typescript-eslint/no-unnecessary-condition': 'warn',
    '@typescript-eslint/no-unnecessary-type-assertion': 'warn',
    '@typescript-eslint/switch-exhaustiveness-check': 'warn',
    '@typescript-eslint/only-throw-error': 'warn',
    '@typescript-eslint/no-base-to-string': 'error',
    '@typescript-eslint/no-for-in-array': 'error',
    '@typescript-eslint/require-array-sort-compare': 'error',
    '@typescript-eslint/no-array-delete': 'error',
    '@typescript-eslint/use-unknown-in-catch-callback-variable': 'error',
    '@typescript-eslint/prefer-promise-reject-errors': 'error',
    '@typescript-eslint/consistent-type-imports': ['warn', { fixStyle: 'inline-type-imports' }],
    '@typescript-eslint/no-import-type-side-effects': 'warn',
    '@typescript-eslint/no-duplicate-type-constituents': 'warn',
    '@typescript-eslint/no-redundant-type-constituents': 'warn',
    '@typescript-eslint/no-unnecessary-type-arguments': 'warn',
    '@typescript-eslint/prefer-includes': 'warn',
    '@typescript-eslint/prefer-string-starts-ends-with': 'warn',
    '@typescript-eslint/no-meaningless-void-operator': 'warn',
    '@typescript-eslint/no-unnecessary-template-expression': 'warn',
    'object-shorthand': 'warn',
    'no-useless-rename': 'warn',
    'arrow-body-style': ['warn', 'as-needed', { requireReturnForObjectLiteral: false }],
    'perfectionist/sort-imports': ['warn', { type: 'natural', order: 'asc', newlinesBetween: 0 }],
    'perfectionist/sort-exports': ['warn', { type: 'natural', order: 'asc', newlinesBetween: 0 }],
    'no-restricted-imports': ['warn', { patterns: [...barrelImportPatterns] }],
    'no-restricted-syntax': ['error', ...restrictedSyntaxBase],
    'no-bitwise': 'error',
    'consistent-return': 'error',
    'no-constant-condition': 'warn',
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
    'no-duplicate-imports': 'warn',
    // 실제 재선언은 TypeScript가 이미 검출한다. 이 규칙은 `as const` enum
    // 대체 패턴(같은 이름의 const와 type alias 한 쌍)도 재선언으로 판단하므로,
    // 타입스크립트 프로젝트에서 흔한 패턴을 허용하기 위해 비활성화한다.
    '@typescript-eslint/no-redeclare': 'off',
    '@typescript-eslint/adjacent-overload-signatures': 'warn'
}

function createBaseConfigs({ tsconfigRootDir, srcGlob = 'src/**' }) {
    return [
        {
            files: [`${srcGlob}/*.ts`],
            linterOptions: { reportUnusedDisableDirectives: true },
            languageOptions: {
                parser: tseslint.parser,
                parserOptions: { sourceType: 'module', projectService: true, tsconfigRootDir },
                globals: { ...baseGlobals }
            },
            plugins: { ...basePlugins },
            rules: { ...baseRules }
        },
        {
            files: [`${srcGlob}/__tests__/**/*.ts`],
            languageOptions: { globals: { ...baseGlobals, ...globals.jest } }
        },
        {
            files: [`${srcGlob}/*.spec.ts`, `${srcGlob}/*.test.ts`],
            ignores: [`${srcGlob}/__tests__/**`],
            rules: {
                'no-restricted-syntax': [
                    'error',
                    ...restrictedSyntaxBase,
                    { selector: 'Program', message: 'Test files must live under __tests__.' }
                ]
            }
        }
    ]
}

module.exports = {
    tseslint,
    baseGlobals,
    basePlugins,
    baseRules,
    barrelImportPatterns,
    nodeBuiltinModulePattern,
    escapeForRegex,
    createBaseConfigs
}
