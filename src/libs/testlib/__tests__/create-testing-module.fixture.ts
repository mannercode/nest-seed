import { Controller, Injectable, Module } from '@nestjs/common'
import { Ctx, KafkaContext, MessagePattern, Payload } from '@nestjs/microservices'
import { Kafka } from 'kafkajs'

// TODO 로거도 붙여야 한다.

@Injectable()
export class SampleService {
    constructor() {}

    async getMessage(arg: string) {
        return { received: arg }
    }
}

@Controller()
class SampleController {
    constructor(private service: SampleService) {}

    async onModuleInit() {
        const kafka = new Kafka({
            clientId: 'my-app',
            brokers: ['nest-kafka1:19092', 'nest-kafka2:19092', 'nest-kafka3:19092']
        })

        const admin = kafka.admin()
        await admin.connect()

        const existingTopics = await admin.listTopics()

        const desiredTopics = [
            { topic: 'getMessage', numPartitions: 6, replicationFactor: 2 },
            { topic: 'getMessage.reply', numPartitions: 6, replicationFactor: 2 }
        ]

        const topicsToCreate = desiredTopics.filter(({ topic }) => !existingTopics.includes(topic))

        if (topicsToCreate.length > 0) {
            await admin.createTopics({
                topics: topicsToCreate,
                // 모든 파티션의 리더가 할당될 때까지 대기합니다.
                // 이는 토픽이 즉시 사용 가능하도록 보장하는 데 유용합니다.
                waitForLeaders: true
            })
        }

        await admin.disconnect()
    }

    @MessagePattern('getMessage')
    getMessage(@Payload() arg: string, @Ctx() context: KafkaContext) {
        return this.service.getMessage(arg)
    }
}

@Module({
    controllers: [SampleController],
    providers: [SampleService]
})
export class SampleModule {}

// @Inject('HERO_SERVICE') private client: ClientKafka

// imports: [
// ClientsModule.registerAsync([
//     {
//         name: 'HERO_SERVICE',
//         useFactory: () => {
//             const { brokers } = getKafkaTestConnection()

//             return {
//                 transport: Transport.KAFKA,
//                 options: {
//                     client: { brokers, clientId: 'hero-client-2' },
//                     // subscribe: { fromBeginning: true },
//                     // producer: { allowAutoTopicCreation: true },
//                     consumer: {
//                         groupId: 'hero-consumer',
//                         allowAutoTopicCreation: true
//                     }
//                 }
//             }
//         }
//     }
// ])
// ],
