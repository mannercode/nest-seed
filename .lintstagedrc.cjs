module.exports = {
    '*.{cjs,js,mjs,mts,ts,tsx}': ['oxlint --fix', 'prettier --write'],
    '*.{json,md,yml,yaml}': ['prettier --write'],
    '*.sh': 'shellcheck --severity=warning -x',
    '.husky/*': 'shellcheck --severity=warning -x',
    'apps/api/api-docs/common.fixture': () =>
        'shellcheck --severity=warning -x apps/api/api-docs/run.sh'
}
