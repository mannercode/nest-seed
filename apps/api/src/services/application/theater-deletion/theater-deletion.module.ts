import { Module } from '@nestjs/common'
import { ShowtimesModule, TheatersModule } from '#core'
import { TheaterDeletionService } from './theater-deletion.service.js'

@Module({
    exports: [TheaterDeletionService],
    imports: [ShowtimesModule, TheatersModule],
    providers: [TheaterDeletionService]
})
export class TheaterDeletionModule {}
