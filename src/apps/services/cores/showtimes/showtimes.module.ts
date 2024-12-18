import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { MongooseConfig } from 'config'
import { Showtime, ShowtimeSchema } from './models'
import { ShowtimesController } from './showtimes.controller'
import { ShowtimesRepository } from './showtimes.repository'
import { ShowtimesService } from './showtimes.service'

@Module({
    imports: [
        MongooseModule.forFeature(
            [{ name: Showtime.name, schema: ShowtimeSchema }],
            MongooseConfig.connName
        )
    ],
    providers: [ShowtimesService, ShowtimesRepository],
    controllers: [ShowtimesController],
    exports: [ShowtimesService]
})
export class ShowtimesModule {}
