import { S3Client } from '@aws-sdk/client-s3'
import { createGlobalTeardown } from '@mannercode/tools/vitest-helpers'
import { jetstreamManager } from '@nats-io/jetstream'
import { connect } from '@nats-io/transport-node'
import { Cluster } from 'ioredis'
import { MongoClient } from 'mongodb'
import { cleanup, ownsEventStream, testConfig } from './src/__tests__/helpers/resources.js'

export default function setup() {
    const config = testConfig()
    const teardown = createGlobalTeardown({
        ...cleanup,
        connectMongo: () => MongoClient.connect(config.mongo.uri),
        createS3Client: () => new S3Client(config.s3),
        connectRedis: () => new Cluster(config.redis.nodes)
    })

    return async () => {
        await Promise.all([teardown(), cleanupEventStreams(config.nats)])
    }
}

async function cleanupEventStreams(options) {
    const connection = await connect(options)
    try {
        const manager = await jetstreamManager(connection)
        const targets = []
        for await (const { config } of manager.streams.list()) {
            if (ownsEventStream(config)) targets.push(config.name)
        }
        await Promise.all(targets.map((name) => manager.streams.delete(name)))
    } finally {
        await connection.drain()
    }
}
