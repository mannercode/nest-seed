import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { MongooseConfig } from 'config'
import { Theater, TheaterSchema } from './models'
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
    exports: [TheatersService]
})
export class TheatersModule {}
