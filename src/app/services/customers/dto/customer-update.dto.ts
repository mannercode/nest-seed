import { PartialType } from '@nestjs/mapped-types'
import { CustomerCreationDto } from './customer-creation.dto'

export class CustomerUpdateDto extends PartialType(CustomerCreationDto) {}
