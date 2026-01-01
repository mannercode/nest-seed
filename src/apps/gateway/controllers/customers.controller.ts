import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Patch,
    Post,
    Query,
    Req,
    UseGuards
} from '@nestjs/common'
import {
    CreateCustomerDto,
    CustomersClient,
    SearchCustomersPageDto,
    UpdateCustomerDto
} from 'apps/cores'
import { Expect } from 'common'
import { CustomerJwtAuthGuard, CustomerLocalAuthGuard, Public } from './guards'
import { CustomerAuthRequest } from './types'

@UseGuards(CustomerJwtAuthGuard)
@Controller('customers')
export class CustomersController {
    constructor(private readonly customersClient: CustomersClient) {}

    @Public()
    @Post()
    async create(@Body() createDto: CreateCustomerDto) {
        return this.customersClient.create(createDto)
    }

    @Patch(':customerId')
    async update(@Param('customerId') customerId: string, @Body() updateDto: UpdateCustomerDto) {
        return this.customersClient.update(customerId, updateDto)
    }

    @Get('jwt-guard')
    async testJwtGuard() {
        return { message: 'accessToken is valid' }
    }

    @Get(':customerId')
    async get(@Param('customerId') customerId: string) {
        const customers = await this.customersClient.getMany([customerId])
        return customers[0]
    }

    @HttpCode(HttpStatus.NO_CONTENT)
    @Delete(':customerId')
    async delete(@Param('customerId') customerId: string) {
        await this.customersClient.deleteMany([customerId])
    }

    @Get()
    async searchPage(@Query() searchDto: SearchCustomersPageDto) {
        return this.customersClient.searchPage(searchDto)
    }

    @UseGuards(CustomerLocalAuthGuard)
    @HttpCode(HttpStatus.OK)
    @Post('login')
    async login(@Req() req: CustomerAuthRequest) {
        Expect.defined(req.user, 'req.user must be returned in LocalStrategy.validate')

        return this.customersClient.generateAuthTokens(req.user)
    }

    @Public()
    @HttpCode(HttpStatus.OK)
    @Post('refresh')
    async refreshToken(@Body('refreshToken') refreshToken: string) {
        return this.customersClient.refreshAuthTokens(refreshToken)
    }
}
