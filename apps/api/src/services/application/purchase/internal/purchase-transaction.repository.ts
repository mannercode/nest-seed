import {
    MongoTransactionRepository,
    MongoConnection,
    type TransactionContext
} from '@mannercode/common'
import { Injectable } from '@nestjs/common'

@Injectable()
export class PurchaseTransactionRepository extends MongoTransactionRepository {
    constructor(connection: MongoConnection) {
        super(connection)
    }

    run<T>(callback: (transaction: TransactionContext) => Promise<T>): Promise<T> {
        return this.withTransaction(callback)
    }
}
