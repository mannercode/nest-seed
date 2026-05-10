import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { MONGO_CONNECTION_NAME } from 'config'
import { Theater, TheaterSchema } from './models'
import { TheatersRepository } from './theaters.repository'
import { TheatersService } from './theaters.service'

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
