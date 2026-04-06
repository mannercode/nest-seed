import { Require } from '@mannercode/common'
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
import { CustomersService } from './customers.service'
import { CreateCustomerDto, SearchCustomersPageDto, UpdateCustomerDto } from './dtos'
import { CustomerAuthRequest, CustomerJwtAuthGuard, CustomerLocalAuthGuard, Public } from './guards'

@Controller('customers')
@UseGuards(CustomerJwtAuthGuard)
export class CustomersHttpController {
    constructor(private readonly service: CustomersService) {}

    @Post()
    @Public()
    async create(@Body() createDto: CreateCustomerDto) {
        return this.service.create(createDto)
    }

    @Delete(':customerId')
    @HttpCode(HttpStatus.NO_CONTENT)
    async delete(@Param('customerId') customerId: string) {
        await this.service.deleteMany([customerId])
    }

    @HttpCode(HttpStatus.OK)
    @Post('login')
    @UseGuards(CustomerLocalAuthGuard)
    async login(@Req() req: CustomerAuthRequest) {
        Require.defined(req.user, 'req.user must be returned in LocalStrategy.validate')

        return this.service.generateAuthTokens(req.user)
    }

    @HttpCode(HttpStatus.OK)
    @Post('refresh')
    @Public()
    async refreshToken(@Body('refreshToken') refreshToken: string) {
        return this.service.refreshAuthTokens(refreshToken)
    }

    @Get('me')
    async getMe(@Req() req: CustomerAuthRequest) {
        return req.user
    }

    @Get()
    async searchPage(@Query() searchDto: SearchCustomersPageDto) {
        return this.service.searchPage(searchDto)
    }

    @Get(':customerId')
    async get(@Param('customerId') customerId: string) {
        const [customer] = await this.service.getMany([customerId])
        return customer
    }

    @Patch(':customerId')
    async update(@Param('customerId') customerId: string, @Body() updateDto: UpdateCustomerDto) {
        return this.service.update(customerId, updateDto)
    }
}
