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
import { Require } from 'common'
import { CustomerJwtAuthGuard, CustomerLocalAuthGuard, Public } from './guards'
import { CustomerAuthRequest } from './types'

@Controller('customers')
@UseGuards(CustomerJwtAuthGuard)
export class CustomersHttpController {
    constructor(private readonly customersClient: CustomersClient) {}

    @Post()
    @Public()
    async create(@Body() createDto: CreateCustomerDto) {
        return this.customersClient.create(createDto)
    }

    @Delete(':customerId')
    @HttpCode(HttpStatus.NO_CONTENT)
    async delete(@Param('customerId') customerId: string) {
        await this.customersClient.deleteMany([customerId])
    }

    @HttpCode(HttpStatus.OK)
    @Post('login')
    @UseGuards(CustomerLocalAuthGuard)
    async login(@Req() req: CustomerAuthRequest) {
        Require.defined(req.user, 'req.user must be returned in LocalStrategy.validate')

        return this.customersClient.generateAuthTokens(req.user)
    }

    @HttpCode(HttpStatus.OK)
    @Post('refresh')
    @Public()
    async refreshToken(@Body('refreshToken') refreshToken: string) {
        return this.customersClient.refreshAuthTokens(refreshToken)
    }

    @Get()
    async searchPage(@Query() searchDto: SearchCustomersPageDto) {
        return this.customersClient.searchPage(searchDto)
    }

    @Get('jwt-guard')
    async testJwtGuard() {
        return { message: 'accessToken is valid' }
    }

    @Get(':customerId')
    async get(@Param('customerId') customerId: string) {
        const [customer] = await this.customersClient.getMany([customerId])
        return customer
    }

    @Patch(':customerId')
    async update(@Param('customerId') customerId: string, @Body() updateDto: UpdateCustomerDto) {
        return this.customersClient.update(customerId, updateDto)
    }
}
