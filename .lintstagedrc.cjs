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
    'libs/temporal-sandbox/**/*.{ts,tsx}': [
        'npm exec --workspace libs/temporal-sandbox -- eslint --fix',
        'prettier --write'
    ],
    'libs/testing/**/*.{ts,tsx}': [
        'npm exec --workspace libs/testing -- eslint --fix',
        'prettier --write'
    ],
    'tests/console-e2e/**/*.{ts,tsx}': [
        'npm exec --workspace tests/console-e2e -- eslint --fix',
        'prettier --write'
    ],
    '*.{cjs,js,json,md,mjs,yml,yaml}': ['prettier --write'],
    '*.sh': ['shellcheck --severity=warning']
}
