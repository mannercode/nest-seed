import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { MongooseSetupModule } from 'modules'
import { Theater, TheaterSchema } from './models'
import { TheatersRepository } from './theaters.repository'
import { TheatersService } from './theaters.service'

@Module({
    exports: [TheatersService],
    imports: [
        MongooseModule.forFeature(
            [{ name: Theater.name, schema: TheaterSchema }],
            MongooseSetupModule.connectionName
        )
    ],
    providers: [TheatersService, TheatersRepository]
})
export class TheatersModule {}
