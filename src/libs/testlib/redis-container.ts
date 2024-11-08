import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers'

const CONTAINER_IMAGE = process.env.REDIS_IMAGE ?? ''

if (!CONTAINER_IMAGE) {
    console.error('REDIS_IMAGE is not defined')
    process.exit(1)
}

const PORT = 6379

export interface RedisContainerContext {
    container: StartedTestContainer
    host: string
    port: number
    close: () => void
}

export async function createRedisContainer(): Promise<RedisContainerContext> {
    const container = await new GenericContainer(CONTAINER_IMAGE)
        .withExposedPorts(PORT)
        .withWaitStrategy(Wait.forLogMessage('Ready to accept connections'))
        .start()
    const host = container.getHost()
    const port = container.getMappedPort(PORT)
    const close = async () => await container.stop()

    return { container, host, port, close }
}
