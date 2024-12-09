import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { Showtime, ShowtimeSchema } from './models'
import { ShowtimesRepository } from './showtimes.repository'
import { ShowtimesService } from './showtimes.service'

@Module({
    imports: [
        MongooseModule.forFeature([{ name: Showtime.name, schema: ShowtimeSchema }], 'mongo')
    ],
    providers: [ShowtimesService, ShowtimesRepository],
    exports: [ShowtimesService]
})
export class ShowtimesModule {}
