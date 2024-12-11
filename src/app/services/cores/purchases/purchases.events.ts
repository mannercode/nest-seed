import { BaseEvent, DefineEvent } from 'common'

@DefineEvent('purchase.created')
export class PurchaseCreatedEvent extends BaseEvent {
    constructor() {
        super()
    }
}

@DefineEvent('purchase.validated')
export class PurchaseValidatedEvent extends BaseEvent {
    constructor() {
        super()
    }
}

@DefineEvent('purchase.paid')
export class PurchasePaidEvent extends BaseEvent {
    constructor() {
        super()
    }
}

@DefineEvent('purchase.completed')
export class PurchaseCompletedEvent extends BaseEvent {
    constructor() {
        super()
    }
}
