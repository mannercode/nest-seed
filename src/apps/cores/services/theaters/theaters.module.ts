import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { MongooseConfig } from 'shared/config'
import { Theater, TheaterSchema } from './models'
import { TheatersController } from './theaters.controller'
import { TheatersRepository } from './theaters.repository'
import { TheatersService } from './theaters.service'

@Module({
    imports: [
        MongooseModule.forFeature(
            [{ name: Theater.name, schema: TheaterSchema }],
            MongooseConfig.connName
        )
    ],
    providers: [TheatersService, TheatersRepository],
    controllers: [TheatersController]
})
export class TheatersModule {}
