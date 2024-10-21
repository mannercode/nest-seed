import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { addRegexQuery, MethodLog, MongooseRepository, ObjectId, PaginationResult } from 'common'
import { FilterQuery, Model } from 'mongoose'
import { CustomerQueryDto } from './dtos'
import { Customer, CustomerCreateData, CustomerUpdateData } from './models'

@Injectable()
export class CustomersRepository extends MongooseRepository<Customer> {
    constructor(@InjectModel(Customer.name) model: Model<Customer>) {
        super(model)
    }

    async onModuleInit() {
        await this.model.createCollection()
    }

    @MethodLog()
    async createCustomer(createDto: CustomerCreateData) {
        if (await this.findByEmail(createDto.email))
            throw new ConflictException(`Customer with email ${createDto.email} already exists`)

        const customer = this.newDocument()
        Object.assign(customer, createDto)

        return customer.save()
    }

    @MethodLog()
    async updateCustomer(customerId: ObjectId, updateDto: CustomerUpdateData) {
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
            addRegexQuery(query, 'name', name)
            addRegexQuery(query, 'email', email)

            helpers.setQuery(query)
        }, pagination)

        return paginated as PaginationResult<Customer>
    }

    @MethodLog({ level: 'verbose' })
    async findByEmail(email: string): Promise<Customer | null> {
        return this.model.findOne({ email: { $eq: email } })
    }
}
