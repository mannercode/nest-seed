// Run the base testing setup (Mongo + S3 lifecycle), then layer on
// per-test Temporal env injection used by @mannercode/microservices tests.
require(require('path').resolve(__dirname, '../jest.setup.js'))

beforeEach(() => {
    const [temporalHost, temporalPort] = process.env.TESTLIB_TEMPORAL_ADDRESS.split(':')
    process.env.TEMPORAL_HOST = temporalHost
    process.env.TEMPORAL_PORT = temporalPort
    process.env.TEMPORAL_NAMESPACE = 'default'
})
