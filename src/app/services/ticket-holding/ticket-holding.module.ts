import { RedisModule } from '@nestjs-modules/ioredis'
import { Module } from '@nestjs/common'
import { AppConfigService, isEnv } from 'config'
import { TicketHoldingService } from './ticket-holding.service'
import { RedisService, generateUUID } from 'common'

@Module({
    imports: [
        RedisModule.forRootAsync({
            useFactory: async (configService: AppConfigService) => {
                const { host, port } = configService.ticketHolding

                return { type: 'single', url: `redis://${host}:${port}` }
            },
            inject: [AppConfigService]
        })
    ],
    providers: [
        TicketHoldingService,
        RedisService,
        {
            provide: 'PREFIX',
            useFactory: () => (isEnv('test') ? 'ticket:' + generateUUID() : 'TicketHolding')
        }
    ],
    exports: [TicketHoldingService]
})
export class TicketHoldingModule {}
