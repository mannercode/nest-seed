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

const escapeForRegex = (value) => value.replace(/[|\\{}()[\]^$+*?.-]/g, '\\$&')

/**
 * Regex string matching every Node.js builtin module (with or without "node:" prefix)
 * and any subpath, e.g. fs, node:fs/promises, crypto, etc. Used by eslint-plugin-
 * allowed-dependencies to ignore builtins.
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
    'object-shorthand': 'warn',
    'no-useless-rename': 'warn',
    'arrow-body-style': ['warn', 'as-needed', { requireReturnForObjectLiteral: false }],
    'perfectionist/sort-imports': ['warn', { type: 'natural', order: 'asc', newlinesBetween: 0 }],
    'perfectionist/sort-exports': ['warn', { type: 'natural', order: 'asc', newlinesBetween: 0 }],
    'no-restricted-imports': ['warn', { patterns: [...barrelImportPatterns] }],
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
    '@typescript-eslint/no-redeclare': 'warn',
    '@typescript-eslint/adjacent-overload-signatures': 'warn'
}

module.exports = {
    tseslint,
    baseGlobals,
    basePlugins,
    baseRules,
    barrelImportPatterns,
    nodeBuiltinModulePattern,
    escapeForRegex
}
