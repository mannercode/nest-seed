module.exports = {
    'apps/api/**/*.{ts,tsx}': [
        "pnpm --filter './apps/api' --fail-if-no-match exec eslint --fix",
        'prettier --write'
    ],
    'apps/console/**/*.{ts,tsx}': [
        "pnpm --filter './apps/console' --fail-if-no-match exec eslint --fix",
        'prettier --write'
    ],
    'apps/user-app/**/*.{ts,tsx}': [
        "pnpm --filter './apps/user-app' --fail-if-no-match exec eslint --fix",
        'prettier --write'
    ],
    'libs/common/**/*.{ts,tsx}': [
        "pnpm --filter './libs/common' --fail-if-no-match exec eslint --fix",
        'prettier --write'
    ],
    'libs/testing/**/*.{ts,tsx}': [
        "pnpm --filter './libs/testing' --fail-if-no-match exec eslint --fix",
        'prettier --write'
    ],
    'tests/web/**/*.{ts,tsx}': [
        "pnpm --filter './tests/web' --fail-if-no-match exec eslint --fix",
        'prettier --write'
    ],
    '*.{cjs,js,mjs}': 'node tools/lint-staged-js.mjs',
    '*.{json,md,yml,yaml}': ['prettier --write'],
    '*.sh': 'node tools/lint-shell.mjs',
    '.husky/*': 'node tools/lint-shell.mjs',
    'apps/api/api-docs/*.{fixture,spec}': 'node tools/lint-shell.mjs'
}
