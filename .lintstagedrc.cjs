module.exports = {
    '*.{cjs,js,mjs,ts,tsx}': ['oxlint --fix -c oxlint.json', 'prettier --write'],
    '*.{json,md,yml,yaml}': ['prettier --write'],
    '*.sh': 'node tools/lint-shell.mjs',
    '.husky/*': 'node tools/lint-shell.mjs',
    'apps/api/api-docs/*.{fixture,spec}': 'node tools/lint-shell.mjs'
}
