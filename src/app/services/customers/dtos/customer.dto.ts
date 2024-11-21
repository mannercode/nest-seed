import { Customer } from '../models'

export class CustomerDto {
    id: string
    name: string
    email: string
    birthdate: Date

    constructor(customer: Customer) {
        // const { id, name, email, birthdate } = customer

        // Object.assign(this, {
        //     id: id.toString(),
        //     name,
        //     email,
        //     birthdate
        // })
        const { createdAt, updatedAt, __v, password, ...rest } = customer

        Object.assign(this, rest)
    }
}
