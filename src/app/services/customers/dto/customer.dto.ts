import { Customer } from '../schemas'

export class CustomerDto {
    id: string
    name: string
    email: string
    birthdate: Date

    constructor(customer: Customer) {
        const { id, name, email, birthdate } = customer

        Object.assign(this, {
            id: id.toString(),
            name,
            email,
            birthdate
        })
    }
}
