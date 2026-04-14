const path = require('path')

const baseTeardown = require(path.resolve(__dirname, '../jest.teardown.js'))

module.exports = async function globalTeardown() {
    await baseTeardown()

    if (globalThis.__TEMPORAL_ENV__) {
        await globalThis.__TEMPORAL_ENV__.teardown()
    }
}
