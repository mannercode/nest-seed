import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { addRegexQuery, MongooseRepository, objectId } from 'common'
import { CoreErrors } from 'cores/core-errors'
import { FilterQuery, Model } from 'mongoose'
import { MongooseConfig } from 'shared/config'
import { CustomerCreateDto, CustomerQueryDto, CustomerUpdateDto } from './dtos'
import { Customer } from './models'

@Injectable()
export class CustomersRepository extends MongooseRepository<Customer> {
    constructor(@InjectModel(Customer.name, MongooseConfig.connName) model: Model<Customer>) {
        super(model)
    }

    async createCustomer(createDto: CustomerCreateDto) {
        const customer = this.newDocument()
        customer.name = createDto.name
        customer.email = createDto.email
        customer.birthdate = createDto.birthdate
        customer.password = createDto.password

        return customer.save()
    }

    async updateCustomer(customerId: string, updateDto: CustomerUpdateDto) {
        const customer = await this.getById(customerId)
        if (updateDto.name) customer.name = updateDto.name
        if (updateDto.email) customer.email = updateDto.email
        if (updateDto.birthdate) customer.birthdate = updateDto.birthdate

        return customer.save()
    }

    async findCustomers(queryDto: CustomerQueryDto) {
        const { name, email, ...pagination } = queryDto

        const paginated = await this.findWithPagination({
            callback: (helpers) => {
                const query: FilterQuery<Customer> = {}
                addRegexQuery(query, 'name', name)
                addRegexQuery(query, 'email', email)

                helpers.setQuery(query)
            },
            pagination
        })

        return paginated
    }

    async findByEmail(email: string) {
        return this.model.findOne({ email: { $eq: email } })
    }

    async getPassword(customerId: string) {
        const customer = await this.model.findById(objectId(customerId)).select('+password').exec()

        if (!customer) {
            throw new NotFoundException({
                ...CoreErrors.Customer.NotFound,
                customerId
            })
        }

        return customer.password
    }
}
