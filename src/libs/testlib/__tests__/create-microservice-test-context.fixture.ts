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
        console.log('onModuleInit')

        const kafka = new Kafka({
            clientId: 'my-app',
            brokers: ['nest-kafka1:19092', 'nest-kafka2:19092', 'nest-kafka3:19092']
        })

        console.log('kafka------------1')
        const admin = kafka.admin()
        console.log('kafka------------2')
        await admin.connect()

        console.log('kafka------------3')

        const existingTopics = await admin.listTopics()

        const generateDesiredTopics = (
            baseTopics: string[],
            // 소규모 애플리케이션: 낮은 처리량과 소수의 소비자 그룹을 가진 경우, 파티션 수를 3~6으로 설정할 수 있습니다.
            // 대규모 애플리케이션: 높은 처리량과 다수의 소비자 그룹을 가진 경우, 파티션 수를 수백 개로 설정할 수 있습니다.
            numPartitions: number,
            // replicationFactor는 클러스터 내 브로커 수보다 작거나 같아야 합니다.
            // 예를 들어, 브로커가 3대라면 최대 복제 인자는 3입니다.
            replicationFactor: number
        ) => {
            const desiredTopics = baseTopics.flatMap((baseTopic) => [
                { topic: baseTopic, numPartitions, replicationFactor },
                { topic: `${baseTopic}.reply`, numPartitions, replicationFactor }
            ])
            return desiredTopics
        }

        const baseTopics = ['getMessage']

        const desiredTopics = generateDesiredTopics(baseTopics, 3, 3)

        const topicsToCreate = desiredTopics.filter(({ topic }) => !existingTopics.includes(topic))

        if (topicsToCreate.length > 0) {
            console.log('kafka------------4')

            await admin.createTopics({
                topics: topicsToCreate,
                // 모든 파티션의 리더가 할당될 때까지 대기합니다.
                // 이는 토픽이 즉시 사용 가능하도록 보장하는 데 유용합니다.
                // waitForLeaders: true
            })

            // await admin.createPartitions({ topicPartitions: [{ topic: 'getMessage', count: 3 },{ topic: 'getMessage.reply', count: 3 }] })
        }

        console.log('kafka------------5')

        console.log(
            'Topics created:',
            topicsToCreate.map(({ topic }) => topic)
        )
        await admin.disconnect()
        console.log('kafka------------6')
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
