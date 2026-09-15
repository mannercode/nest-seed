module.exports = {
    '*.{cjs,js,mjs,mts,ts,tsx}': ['oxlint --fix -c oxlint.config.mts', 'prettier --write'],
    '*.{json,md,yml,yaml}': ['prettier --write'],
    '*.sh': 'shellcheck --severity=warning -x',
    '.husky/*': 'shellcheck --severity=warning -x',
    'apps/api/api-docs/*.{fixture,spec}': () =>
        'bash -c "shellcheck --severity=warning -x apps/api/api-docs/*.spec"'
}
