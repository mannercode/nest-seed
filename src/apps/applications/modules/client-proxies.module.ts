import { Module } from '@nestjs/common'
import { Transport } from '@nestjs/microservices'
import { ClientProxyModule, generateShortId } from 'common'
import { Partitioners } from 'kafkajs'
import { AppConfigService, isTest, microserviceMessages } from 'shared/config'

@Module({
    imports: [
        ClientProxyModule.registerAsync({
            name: 'clientProxy',
            useFactory: async (config: AppConfigService) => {
                const brokers = config.brokers
                const groupId = isTest() ? 'test_' + generateShortId() : 'applications'
                const clientId = 'applications'

                return {
                    transport: Transport.KAFKA,
                    options: {
                        client: { brokers, clientId },
                        producer: {
                            allowAutoTopicCreation: false,
                            createPartitioner: Partitioners.DefaultPartitioner
                        },
                        consumer: {
                            groupId,
                            allowAutoTopicCreation: false,
                            maxWaitTimeInMs: 0
                        }
                    }
                }
            },
            inject: [AppConfigService],
            messages: microserviceMessages
        })
    ]
})
export class ClientProxiesModule {}
