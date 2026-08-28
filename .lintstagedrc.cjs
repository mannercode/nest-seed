module.exports = {
    'apps/api/**/*.{ts,tsx}': ['npm exec --workspace apps/api -- eslint --fix', 'prettier --write'],
    'apps/console/**/*.{ts,tsx}': [
        'npm exec --workspace apps/console -- eslint --fix',
        'prettier --write'
    ],
    'apps/user-app/**/*.{ts,tsx}': [
        'npm exec --workspace apps/user-app -- eslint --fix',
        'prettier --write'
    ],
    'libs/common/**/*.{ts,tsx}': [
        'npm exec --workspace libs/common -- eslint --fix',
        'prettier --write'
    ],
    'libs/testing/**/*.{ts,tsx}': [
        'npm exec --workspace libs/testing -- eslint --fix',
        'prettier --write'
    ],
    'tests/web/**/*.{ts,tsx}': [
        'npm exec --workspace tests/web -- eslint --fix',
        'prettier --write'
    ],
    '*.{cjs,js,mjs}': 'node tools/lint-staged-js.mjs',
    '*.{json,md,yml,yaml}': ['prettier --write'],
    '*.sh': 'node tools/lint-shell.mjs',
    '.husky/*': 'node tools/lint-shell.mjs',
    'apps/api/api-docs/*.{fixture,spec}': 'node tools/lint-shell.mjs'
}
