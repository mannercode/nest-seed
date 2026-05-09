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
 * 모든 Node.js builtin module 에 매치되는 regex 문자열 ("node:" 접두사 유무 모두,
 * 그리고 임의 subpath 포함) — 예: fs, node:fs/promises, crypto 등. eslint-plugin-
 * allowed-dependencies 가 builtin 을 무시할 때 사용한다.
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
    // 실제 redeclare 는 TS 가 이미 잡아준다. 이 rule 은 추가로 `as const` enum
    // 의 canonical 대체 패턴인 const + 같은 이름의 type alias 까지 잡는데
    // false positive 가 나서 비활성화.
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
                parserOptions: {
                    sourceType: 'module',
                    projectService: true,
                    tsconfigRootDir
                },
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
