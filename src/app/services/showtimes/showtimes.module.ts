import { BullModule } from '@nestjs/bull'
import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { EventService, ServerSentEventsService } from 'common'
import { MoviesModule } from '../movies'
import { TheatersModule } from '../theaters'
import { Showtime, ShowtimeSchema } from './schemas'
import { ShowtimesRepository } from './showtimes.repository'
import { ShowtimesService } from './showtimes.service'

@Module({
    imports: [
        MongooseModule.forFeature([{ name: Showtime.name, schema: ShowtimeSchema }]),
        BullModule.registerQueue({ name: 'showtimes' }),
        MoviesModule,
        TheatersModule
    ],
    providers: [
        EventService,
        ServerSentEventsService,
        ShowtimesService,
        ShowtimesRepository
    ],
    exports: [ShowtimesService]
})
export class ShowtimesModule {}
