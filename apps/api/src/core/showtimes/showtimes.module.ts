import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { MongooseConfigModule } from 'shared'
import { Showtime, ShowtimeSchema } from './models'
import { ShowtimesRepository } from './showtimes.repository'
import { ShowtimesService } from './showtimes.service'

@Module({
    exports: [ShowtimesService],
    imports: [
        MongooseModule.forFeature(
            [{ name: Showtime.name, schema: ShowtimeSchema }],
            MongooseConfigModule.connectionName
        )
    ],
    providers: [ShowtimesService, ShowtimesRepository]
})
export class ShowtimesModule {}
