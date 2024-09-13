import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { MethodLog, MongooseRepository, PaginationOption, PaginationResult } from 'common'
import { escapeRegExp } from 'lodash'
import { FilterQuery, Model } from 'mongoose'
import { CreateCustomerDto, QueryCustomersDto, UpdateCustomerDto } from './dto'
import { Customer } from './schemas'

@Injectable()
export class CustomersRepository extends MongooseRepository<Customer> {
    constructor(@InjectModel(Customer.name) model: Model<Customer>) {
        super(model)
    }

    async onModuleInit() {
        await this.model.createCollection()
    }

    @MethodLog()
    async createCustomer(createDto: CreateCustomerDto) {
        if (await this.findByEmail(createDto.email))
            throw new ConflictException(`Customer with email ${createDto.email} already exists`)

        const customer = this.newDocument()
        customer.name = createDto.name
        customer.email = createDto.email
        customer.birthdate = createDto.birthdate
        customer.password = createDto.password

        return customer.save()
    }

    @MethodLog()
    async updateCustomer(customerId: string, updateDto: UpdateCustomerDto) {
        const customer = await this.getCustomer(customerId)

        if (updateDto.name) customer.name = updateDto.name
        if (updateDto.email) customer.email = updateDto.email
        if (updateDto.birthdate) customer.birthdate = updateDto.birthdate

        return customer.save()
    }

    @MethodLog()
    async deleteCustomer(customerId: string) {
        const customer = await this.getCustomer(customerId)
        await customer.deleteOne()
    }

    @MethodLog({ level: 'verbose' })
    async getCustomer(customerId: string) {
        const customer = await this.findById(customerId)

        if (!customer) throw new NotFoundException(`Customer with ID ${customerId} not found`)

        return customer
    }

    @MethodLog({ level: 'verbose' })
    async findCustomers(queryDto: QueryCustomersDto, pagination: PaginationOption) {
        const paginated = await this.findWithPagination((helpers) => {
            const { name, email } = queryDto

            const query: FilterQuery<Customer> = {}
            if (name) query.name = new RegExp(escapeRegExp(name), 'i')
            if (email) query.email = new RegExp(escapeRegExp(email), 'i')

            helpers.setQuery(query)
        }, pagination)

        return paginated as PaginationResult<Customer>
    }

    @MethodLog({ level: 'verbose' })
    async findByEmail(email: string): Promise<Customer | null> {
        return this.model.findOne({ email })
    }
}
