import { MongoConnection, MongoTransactionRepository } from '@mannercode/common'
import { Injectable } from '@nestjs/common'

@Injectable()
export class RegistrationTransactionRepository extends MongoTransactionRepository {
    constructor(connection: MongoConnection) {
        super(connection)
    }
}
