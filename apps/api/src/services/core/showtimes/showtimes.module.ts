import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { MONGO_CONNECTION_NAME } from 'config'
import { Showtime, ShowtimeSchema } from './models'
import { ShowtimesRepository } from './showtimes.repository'
import { ShowtimesService } from './showtimes.service'

@Module({
    exports: [ShowtimesService],
    imports: [
        MongooseModule.forFeature(
            [{ name: Showtime.name, schema: ShowtimeSchema }],
            MONGO_CONNECTION_NAME
        )
    ],
    providers: [ShowtimesService, ShowtimesRepository]
})
export class ShowtimesModule {}
