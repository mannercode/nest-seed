module.exports = {
    '*.{cjs,js,mjs,ts,tsx}': ['oxlint --fix -c oxlint.json', 'prettier --write'],
    '*.{json,md,yml,yaml}': ['prettier --write'],
    '*.sh': 'shellcheck --severity=warning -x',
    '.husky/*': 'shellcheck --severity=warning -x',
    'apps/api/api-docs/*.{fixture,spec}': () =>
        'shellcheck --severity=warning -x apps/api/api-docs/*.spec'
}
