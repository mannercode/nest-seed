export class CustomerDto {
    id: string
    name: string
    email: string
    birthdate: Date
}

export const nullCustomer = { id: '', name: '', email: '', birthdate: new Date(0) }
