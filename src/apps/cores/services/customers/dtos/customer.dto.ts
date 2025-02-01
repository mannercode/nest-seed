import { BaseDto } from "common"

export class CustomerDto extends BaseDto {
    id: string
    name: string
    email: string
    birthdate: Date
}

export const nullCustomer = { id: '', name: '', email: '', birthdate: new Date(0) }
