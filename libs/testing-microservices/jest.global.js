const path = require('path')
const { NatsContainer } = require('@testcontainers/nats')
const { TestWorkflowEnvironment } = require('@temporalio/testing')

// Reuse base infra setup from @mannercode/testing (mongo + redis + minio)
// and additionally start NATS + an ephemeral Temporal worker environment.
const baseGlobalSetup = require(path.resolve(__dirname, '../jest.global.js'))

const NATS_IMAGE = process.env.NATS_IMAGE || 'nats:2.12-alpine'

module.exports = async function globalSetup() {
    await baseGlobalSetup()

    const [nats, temporal] = await Promise.all([
        new NatsContainer(NATS_IMAGE)
            .withName('testlib-nats')
            .withReuse()
            .withResourcesQuota({ memory: 0.25 })
            .start(),
        TestWorkflowEnvironment.createLocal()
    ])

    process.env.TESTLIB_NATS_OPTIONS = JSON.stringify(nats.getConnectionOptions())
    process.env.TESTLIB_TEMPORAL_ADDRESS = temporal.address

    globalThis.__TEMPORAL_ENV__ = temporal
}
