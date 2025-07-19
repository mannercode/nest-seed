import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { MongooseRepository, objectId, QueryBuilder, QueryBuilderOptions } from 'common'
import { Model } from 'mongoose'
import { MongooseConfigModule } from 'shared'
import { CreateCustomerDto, SearchCustomersPageDto, UpdateCustomerDto } from './dtos'
import { CustomerErrors } from './errors'
import { Customer } from './models'

@Injectable()
export class CustomersRepository extends MongooseRepository<Customer> {
    constructor(
        @InjectModel(Customer.name, MongooseConfigModule.connectionName) model: Model<Customer>
    ) {
        super(model, MongooseConfigModule.maxTake)
    }

    async createCustomer(createDto: CreateCustomerDto) {
        const customer = this.newDocument()
        customer.name = createDto.name
        customer.email = createDto.email
        customer.birthDate = createDto.birthDate
        customer.password = createDto.password

        return customer.save()
    }

    async updateCustomer(customerId: string, updateDto: UpdateCustomerDto) {
        const customer = await this.getById(customerId)

        if (updateDto.name) customer.name = updateDto.name
        if (updateDto.email) customer.email = updateDto.email
        if (updateDto.birthDate) customer.birthDate = updateDto.birthDate

        return customer.save()
    }

    async searchCustomersPage(searchDto: SearchCustomersPageDto) {
        const { take, skip, orderby } = searchDto

        const pagination = await this.findWithPagination({
            configureQuery: (queryHelper) => {
                const query = this.buildQuery(searchDto, { allowEmpty: true })

                queryHelper.setQuery(query)
            },
            pagination: { take, skip, orderby }
        })

        return pagination
    }

    async findByEmail(email: string) {
        return this.model.findOne({ email: { $eq: email } })
    }

    async getPassword(customerId: string) {
        const customer = await this.model.findById(objectId(customerId)).select('+password').exec()

        if (!customer) {
            throw new NotFoundException({ ...CustomerErrors.NotFound, customerId })
        }

        return customer.password
    }

    private buildQuery(searchDto: SearchCustomersPageDto, options: QueryBuilderOptions) {
        const { name, email } = searchDto

        const builder = new QueryBuilder<Customer>()
        builder.addRegex('name', name)
        builder.addRegex('email', email)

        const query = builder.build(options)
        return query
    }
}
