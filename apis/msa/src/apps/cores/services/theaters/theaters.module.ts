import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { MongooseConfigModule } from 'config'
import { Theater, TheaterSchema } from './models'
import { TheatersController } from './theaters.controller'
import { TheatersHttpController } from './theaters.http-controller'
import { TheatersRepository } from './theaters.repository'
import { TheatersService } from './theaters.service'

@Module({
    controllers: [TheatersController, TheatersHttpController],
    imports: [
        MongooseModule.forFeature(
            [{ name: Theater.name, schema: TheaterSchema }],
            MongooseConfigModule.connectionName
        )
    ],
    providers: [TheatersService, TheatersRepository]
})
export class TheatersModule {}
