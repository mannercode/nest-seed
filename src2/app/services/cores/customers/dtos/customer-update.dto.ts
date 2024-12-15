import { PartialType } from '@nestjs/mapped-types'
import { CustomerCreateDto } from './customer-create.dto'

export class CustomerUpdateDto extends PartialType(CustomerCreateDto) {}
