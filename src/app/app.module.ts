import { INestApplication, Module } from '@nestjs/common'
import { AppLoggerService } from 'common'
import * as compression from 'compression'
import { AppConfigService } from 'config'
import * as express from 'express'
import { existsSync } from 'fs'
import { exit } from 'process'
import { BookingModule } from 'services/booking'
import { CustomersModule } from 'services/customers'
import { MoviesModule } from 'services/movies'
import { PaymentsModule } from 'services/payments'
import { PurchasesModule } from 'services/purchases'
import { RecommendationModule } from 'services/recommendation'
import { ShowtimeCreationModule } from 'services/showtime-creation'
import { ShowtimesModule } from 'services/showtimes'
import { StorageFilesModule } from 'services/storage-files'
import { TheatersModule } from 'services/theaters'
import { TicketHoldingModule } from 'services/ticket-holding'
import { TicketsModule } from 'services/tickets'
import { WatchRecordsModule } from 'services/watch-records'
import {
    BookingController,
    CustomersController,
    MoviesController,
    PurchasesController,
    ShowtimeCreationController,
    StorageFilesController,
    TheatersController
} from './controllers'
import { CustomerJwtStrategy, CustomerLocalStrategy } from './controllers/guards'
import { CoreModule } from './core'
import { HealthModule } from './health.module'

@Module({
    imports: [
        CoreModule,
        CustomersModule,
        StorageFilesModule,
        MoviesModule,
        TheatersModule,
        ShowtimesModule,
        TicketsModule,
        ShowtimeCreationModule,
        TicketHoldingModule,
        HealthModule,
        WatchRecordsModule,
        RecommendationModule,
        BookingModule,
        PaymentsModule,
        PurchasesModule
    ],
    providers: [CustomerLocalStrategy, CustomerJwtStrategy],
    controllers: [
        CustomersController,
        StorageFilesController,
        MoviesController,
        TheatersController,
        ShowtimeCreationController,
        BookingController,
        PurchasesController
    ]
})
export class AppModule {}

export function configureApp(app: INestApplication<any>) {
    app.use(compression())

    const logger = app.get(AppLoggerService)
    app.useLogger(logger)

    const config = app.get(AppConfigService)
    const limit = config.http.requestPayloadLimit
    app.use(express.json({ limit }))
    app.use(express.urlencoded({ limit, extended: true }))

    for (const dir of [
        { name: 'FileUpload', path: config.fileUpload.directory },
        { name: 'Log', path: config.log.directory }
    ]) {
        if (!existsSync(dir.path)) {
            console.error(`${dir.name} directory does not exist: ${dir.path}`)
            exit(1)
        }
    }
}
