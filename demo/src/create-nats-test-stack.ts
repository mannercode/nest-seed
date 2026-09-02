import { NestFactory } from '@nestjs/core'
import {
    ClientProxyFactory,
    Transport,
    type ClientProxy,
    type MicroserviceOptions
} from '@nestjs/microservices'
import { firstValueFrom } from 'rxjs'
import { CalculatorModule } from './calculator.module.js'
import { MessagePatterns } from './message-patterns.js'

export async function createNatsTestStack() {
    const servers = [natsUrl()]
    const server = await NestFactory.createMicroservice<MicroserviceOptions>(CalculatorModule, {
        logger: false,
        options: { queue: `${requiredEnvironment('MESSAGE_NAMESPACE')}.calculator`, servers },
        transport: Transport.NATS
    })
    const client = ClientProxyFactory.create({ options: { servers }, transport: Transport.NATS })

    try {
        await server.listen()
        await client.connect()
    } catch (error) {
        await closeStack(client, server).catch(() => undefined)
        throw error
    }

    return {
        add: (left: number, right: number) =>
            firstValueFrom(
                client.send<number, { left: number; right: number }>(
                    MessagePatterns.calculator.add,
                    { left, right }
                )
            ),
        close: () => closeStack(client, server),
        pattern: MessagePatterns.calculator.add
    }
}

function natsUrl() {
    if (process.env.NATS_URL) return process.env.NATS_URL

    const host = process.env.NATS_HOST ?? '127.0.0.1'
    const port = process.env.NATS_PORT ?? '4222'
    return `nats://${host}:${port}`
}

function requiredEnvironment(name: string) {
    const value = process.env[name]
    if (!value) throw new Error(`${name} must be defined.`)
    return value
}

async function closeStack(
    client: ClientProxy,
    server: Awaited<ReturnType<typeof NestFactory.createMicroservice>>
) {
    try {
        await client.close()
    } finally {
        await server.close()
    }
}
