module.exports = async function globalSetup() {
    return require('./vitest.teardown.cjs')
}
