import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { MethodLog, ModelAttributes, MongooseRepository, ObjectId, PaginationResult } from 'common'
import { escapeRegExp } from 'lodash'
import { FilterQuery, Model } from 'mongoose'
import { CustomerQueryDto } from './dto'
import { Customer } from './models'

@Injectable()
export class CustomersRepository extends MongooseRepository<Customer> {
    constructor(@InjectModel(Customer.name) model: Model<Customer>) {
        super(model)
    }

    async onModuleInit() {
        await this.model.createCollection()
    }

    @MethodLog()
    async createCustomer(creationDto: ModelAttributes<Customer>) {
        if (await this.findByEmail(creationDto.email))
            throw new ConflictException(`Customer with email ${creationDto.email} already exists`)

        const customer = this.newDocument()
        Object.assign(customer, creationDto)

        return customer.save()
    }

    @MethodLog()
    async updateCustomer(customerId: ObjectId, updateDto: Partial<ModelAttributes<Customer>>) {
        const customer = await this.getCustomer(customerId)

        if (updateDto.name) customer.name = updateDto.name
        if (updateDto.email) customer.email = updateDto.email
        if (updateDto.birthdate) customer.birthdate = updateDto.birthdate

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
            if (name) query.name = new RegExp(escapeRegExp(name), 'i')
            if (email) query.email = new RegExp(escapeRegExp(email), 'i')

            helpers.setQuery(query)
        }, pagination)

        return paginated as PaginationResult<Customer>
    }

    @MethodLog({ level: 'verbose' })
    async findByEmail(email: string): Promise<Customer | null> {
        return this.model.findOne({ email: { $eq: email } })
    }
}
