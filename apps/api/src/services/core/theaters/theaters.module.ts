import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { MONGO_CONNECTION_NAME } from '#config'
import { Theater, TheaterSchema } from './models/index.js'
import { TheatersRepository } from './theaters.repository.js'
import { TheatersService } from './theaters.service.js'

@Module({
    exports: [TheatersService],
    imports: [
        MongooseModule.forFeature(
            [{ name: Theater.name, schema: TheaterSchema }],
            MONGO_CONNECTION_NAME
        )
    ],
    providers: [TheatersService, TheatersRepository]
})
export class TheatersModule {}
