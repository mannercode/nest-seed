const { cleanupTestResources } = require('./test-resources.cjs')
const { cleanup } = require('./vitest.resources.cjs')

module.exports = async function globalSetup() {
    return () => cleanupTestResources(cleanup)
}
