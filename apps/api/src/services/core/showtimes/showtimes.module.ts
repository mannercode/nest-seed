import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { MongooseSetupModule } from 'modules'
import { Showtime, ShowtimeSchema } from './models'
import { ShowtimesRepository } from './showtimes.repository'
import { ShowtimesService } from './showtimes.service'

@Module({
    exports: [ShowtimesService],
    imports: [
        MongooseModule.forFeature(
            [{ name: Showtime.name, schema: ShowtimeSchema }],
            MongooseSetupModule.connectionName
        )
    ],
    providers: [ShowtimesService, ShowtimesRepository]
})
export class ShowtimesModule {}
