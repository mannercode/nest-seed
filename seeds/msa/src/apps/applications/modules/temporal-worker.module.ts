import { Json } from '@mannercode/common'
import { Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { bundleWorkflowCode, NativeConnection, Worker } from '@temporalio/worker'
import { ShowtimesClient, TicketsClient, PurchaseRecordsClient } from 'apps/cores'
import { PaymentsClient } from 'apps/infrastructures'
import { AppConfigService, getTemporalTaskQueue } from 'config'
import * as fs from 'fs'
import * as path from 'path'
import {
    createPurchaseActivities,
    PurchaseModule,
    TicketPurchaseService,
    createShowtimeCreationActivities,
    ShowtimeBulkCreatorService,
    ShowtimeBulkValidatorService,
    ShowtimeCreationEvents,
    ShowtimeCreationModule
} from '../services'

@Module({ imports: [PurchaseModule, ShowtimeCreationModule] })
export class TemporalWorkerModule implements OnModuleInit, OnModuleDestroy {
    private worker!: Worker

    constructor(
        private readonly config: AppConfigService,
        private readonly ticketPurchaseService: TicketPurchaseService,
        private readonly paymentsClient: PaymentsClient,
        private readonly purchaseRecordsClient: PurchaseRecordsClient,
        private readonly validatorService: ShowtimeBulkValidatorService,
        private readonly creatorService: ShowtimeBulkCreatorService,
        private readonly showtimeCreationEvents: ShowtimeCreationEvents,
        private readonly showtimesClient: ShowtimesClient,
        private readonly ticketsClient: TicketsClient
    ) {}

    async onModuleInit() {
        const connection = await NativeConnection.connect({ address: this.config.temporal.address })

        const workflowBundle = await this.loadWorkflowBundle()

        const purchaseActivities = createPurchaseActivities({
            ticketPurchaseService: this.ticketPurchaseService,
            paymentsClient: this.paymentsClient,
            purchaseRecordsClient: this.purchaseRecordsClient
        })

        const showtimeCreationActivities = createShowtimeCreationActivities({
            validatorService: this.validatorService,
            creatorService: this.creatorService,
            events: this.showtimeCreationEvents,
            showtimesClient: this.showtimesClient,
            ticketsClient: this.ticketsClient,
            reviveIsoDates: Json.reviveIsoDates
        })

        this.worker = await Worker.create({
            connection,
            namespace: this.config.temporal.namespace,
            taskQueue: getTemporalTaskQueue(),
            workflowBundle,
            activities: { ...purchaseActivities, ...showtimeCreationActivities }
        })

        void this.worker.run()
    }

    async onModuleDestroy() {
        this.worker.shutdown()
    }

    private async loadWorkflowBundle() {
        const prebuiltPath = path.join(process.cwd(), '_output/dist/workflow-bundle.js')

        try {
            const code = fs.readFileSync(prebuiltPath, 'utf8')
            if (code) return { code }
        } catch {}

        return bundleWorkflowCode({
            workflowsPath: path.resolve(process.cwd(), 'src/apps/applications/workflows/index.ts')
        })
    }
}
