import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { addRegexQuery, MethodLog, MongooseRepository, ObjectId, PaginationResult } from 'common'
import { FilterQuery, Model } from 'mongoose'
import { CustomerQueryDto } from './dtos'
import { Customer, CustomerCreatePayload, CustomerUpdatePayload } from './models'

@Injectable()
export class CustomersRepository extends MongooseRepository<Customer> {
    constructor(@InjectModel(Customer.name) model: Model<Customer>) {
        super(model)
    }

    @MethodLog()
    async createCustomer(payload: CustomerCreatePayload) {
        if (await this.findByEmail(payload.email))
            throw new ConflictException(`Customer with email ${payload.email} already exists`)

        const customer = this.newDocument()
        Object.assign(customer, payload)

        return customer.save()
    }

    @MethodLog()
    async updateCustomer(customerId: ObjectId, payload: CustomerUpdatePayload) {
        const customer = await this.getCustomer(customerId)

        if (payload.name) customer.name = payload.name
        if (payload.email) customer.email = payload.email
        if (payload.birthdate) customer.birthdate = payload.birthdate

        return customer.save()
    }

    @MethodLog()
    async deleteCustomer(customerId: ObjectId) {
        const customer = await this.getCustomer(customerId)
        await customer.deleteOne()
    }

    @MethodLog({ level: 'verbose' })
    async getCustomer(customerId: ObjectId) {
        const customer = await this.findById(customerId)

        if (!customer) throw new NotFoundException(`Customer with ID ${customerId} not found`)

        return customer
    }

    @MethodLog({ level: 'verbose' })
    async findCustomers(queryDto: CustomerQueryDto) {
        const { name, email, ...pagination } = queryDto

        const paginated = await this.findWithPagination((helpers) => {
            const query: FilterQuery<Customer> = {}
            addRegexQuery(query, 'name', name)
            addRegexQuery(query, 'email', email)

            helpers.setQuery(query)
        }, pagination)

        return paginated
    }

    @MethodLog({ level: 'verbose' })
    async findByEmail(email: string) {
        return this.model.findOne({ email: { $eq: email } })
    }
}
