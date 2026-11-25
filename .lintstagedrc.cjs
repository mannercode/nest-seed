module.exports = {
    '*.{cjs,js,mjs,mts,ts,tsx}': ['oxlint --fix', 'prettier --write'],
    '*.{json,md,yml,yaml}': ['prettier --write'],
    '*.sh': 'shellcheck --severity=warning -ax',
    '.husky/*': 'shellcheck --severity=warning -ax',
    'apps/api/api-docs/**/*.{spec,cfg}': 'shellcheck --shell=bash --severity=warning',
    'apps/api/api-docs/common.fixture': () =>
        'shellcheck --severity=warning -ax apps/api/api-docs/run.sh'
}
