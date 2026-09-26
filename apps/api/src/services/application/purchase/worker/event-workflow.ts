import { defineWorkflow } from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import { AppConfigService } from '#config'
import { PurchaseRecordSchema, type PurchaseRecordDto } from '#core'
import { PurchaseEventService } from '../purchase-event.service.js'

@Injectable()
export class PurchaseEventWorkflow {
    readonly definition

    constructor(events: PurchaseEventService, config: AppConfigService) {
        this.definition = defineWorkflow({
            name: `PurchaseEvent-${config.projectId}`,
            input: PurchaseRecordSchema,
            run: async (ctx, record: PurchaseRecordDto) => {
                await ctx.run(
                    'publish purchase event',
                    () =>
                        events.emitTicketPurchased({
                            purchaseRecordId: record.id,
                            ticketIds: record.purchaseItems.map((item) => item.itemId),
                            userId: record.userId
                        }),
                    { initialRetryInterval: 1_000 }
                )
            },
            options: {
                abortTimeout: 5_000,
                inactivityTimeout: 65_000,
                workflowRetention: 24 * 60 * 60 * 1_000
            }
        })
    }
}
