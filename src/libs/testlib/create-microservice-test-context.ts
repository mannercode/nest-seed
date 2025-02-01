import { INestMicroservice } from '@nestjs/common'
import { KafkaOptions, Transport } from '@nestjs/microservices'
import { TestingModule } from '@nestjs/testing'
import { generateShortId } from 'common'
import { createTestingModule, ModuleMetadataEx } from './create-testing-module'
import { MicroserviceTestClient } from './microservice.test-client'
import { getKafkaTestConnection } from './test-containers'
import { Partitioners } from 'kafkajs'

export interface MicroserviceTestContext {
    module: TestingModule
    app: INestMicroservice
    client: MicroserviceTestClient
    close: () => Promise<void>
}

export async function createMicroserviceTestContext(
    msMetadata: ModuleMetadataEx & { messages?: string[] },
    configureApp?: (app: INestMicroservice) => void
) {
    const { messages, ...metadata } = msMetadata
    const module = await createTestingModule(metadata)

    const { brokers } = getKafkaTestConnection()

    const rpcOptions: KafkaOptions = {
        transport: Transport.KAFKA,
        options: {
            client: { brokers },
            producer: {
                /*
                kafkajs의 allowAutoTopicCreation은 오류가 있기 때문에 사용하지 않는다.
                */
                allowAutoTopicCreation: false,
                /* Partitioner를 지정하지 않으면 경고 발생 */
                createPartitioner: Partitioners.DefaultPartitioner
            },
            consumer: {
                groupId: generateShortId(),
                allowAutoTopicCreation: false,
                /*
                maxWaitTimeInMs는 Kafka 브로커가 fetch 요청에 대해 데이터를 즉시 충분히 제공할 수 없을 때,
                즉 minBytes로 지정된 최소 데이터 양을 만족시킬 만큼 데이터가 아직 모이지 않았을 경우,
                브로커가 최대 얼마 동안(밀리초 단위) 대기(block)할지를 설정하는 옵션입니다.
                만약 설정된 대기 시간 동안에 minBytes 조건을 만족하는 데이터가 모이면,
                그 즉시 fetch 요청에 대한 응답을 주게 됩니다.

                maxWaitTimeInMs를 0으로 설정하면, 서버는 데이터를 기다리지 않고 즉시 응답을 보내게 됩니다.
                즉, minBytes에 지정된 조건을 만족할 만큼의 데이터가 모이지 않았더라도 최대 대기 시간 없이 바로 응답을 반환합니다.
                그 결과, 충분한 데이터가 쌓이지 않은 상태에서 자주 폴링을 하게 되므로 빈 응답을 더 자주 받을 수 있고,
                그만큼 브로커와 클라이언트의 부하(트래픽)가 늘어날 수 있습니다.

                close 하는데 시간이 걸리는 경우가 있어서 0으로 설정합니다.
                */
                maxWaitTimeInMs: 0
            }
        }
    }

    const app = module.createNestMicroservice(rpcOptions)
    if (configureApp) await configureApp(app)

    const isDebuggingEnabled = process.env.NODE_OPTIONS !== undefined
    app.useLogger(isDebuggingEnabled ? console : false)

    await app.listen()

    const client = await MicroserviceTestClient.create(rpcOptions, messages)

    const close = async () => {
        await client.close()
        await app.close()
    }

    return { module, app, close, client } as MicroserviceTestContext
}
