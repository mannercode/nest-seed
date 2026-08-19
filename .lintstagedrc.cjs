const path = require('node:path')

const shellQuote = (value) => `'${value.replaceAll("'", "'\\''")}'`

const workspaceTypeScriptTasks = (workspace) => (files) => {
    const workspaceDirectory = path.resolve(__dirname, workspace)
    const relativeFiles = files.map((file) => {
        const relativeFile = path.relative(workspaceDirectory, file)
        if (relativeFile.startsWith(`..${path.sep}`) || path.isAbsolute(relativeFile)) {
            throw new Error(`lint-staged received a file outside ${workspace}: ${file}`)
        }
        return shellQuote(relativeFile)
    })
    const argumentsList = relativeFiles.join(' ')
    return [
        `npm exec --workspace ${shellQuote(workspace)} -- eslint --fix ${argumentsList}`,
        `npm exec --workspace ${shellQuote(workspace)} -- prettier --write ${argumentsList}`
    ]
}

module.exports = {
    'apps/api/**/*.{ts,tsx}': workspaceTypeScriptTasks('apps/api'),
    'apps/console/**/*.{ts,tsx}': workspaceTypeScriptTasks('apps/console'),
    'apps/user-app/**/*.{ts,tsx}': workspaceTypeScriptTasks('apps/user-app'),
    'libs/common/**/*.{ts,tsx}': workspaceTypeScriptTasks('libs/common'),
    'libs/temporal-sandbox/**/*.{ts,tsx}': workspaceTypeScriptTasks('libs/temporal-sandbox'),
    'libs/testing/**/*.{ts,tsx}': workspaceTypeScriptTasks('libs/testing'),
    'tests/console-e2e/**/*.{ts,tsx}': workspaceTypeScriptTasks('tests/console-e2e'),
    '*.{cjs,js,json,md,mjs,yml,yaml}': ['prettier --write'],
    '*.sh': ['shellcheck --severity=warning']
}
