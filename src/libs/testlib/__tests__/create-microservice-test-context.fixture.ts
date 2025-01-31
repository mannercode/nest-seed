import { Controller, Module } from '@nestjs/common'
import { Ctx, KafkaContext, MessagePattern, Payload } from '@nestjs/microservices'

// TODO 로거도 붙여야 한다.
@Controller()
class SampleController {
    @MessagePattern('test.getMessage')
    getMessage(@Payload() arg: string, @Ctx() _ctx: KafkaContext) {
        return { received: arg }
    }
}

@Module({ controllers: [SampleController] })
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
