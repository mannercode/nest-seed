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
    UseGuards,
    UsePipes
} from '@nestjs/common'
import { Assert, AuthTokenPayload } from 'common'
import {
    CustomerCreateDto,
    CustomerQueryDto,
    CustomersService,
    CustomerUpdateDto
} from 'services/cores'
import { CustomerJwtAuthGuard, CustomerLocalAuthGuard, Public } from './guards'
import { DefaultPaginationPipe } from './pipes'

@Controller('customers')
@UseGuards(CustomerJwtAuthGuard)
export class CustomersController {
    constructor(private service: CustomersService) {}

    @Public()
    @Post()
    async createCustomer(@Body() createDto: CustomerCreateDto) {
        return this.service.createCustomer(createDto)
    }

    @Patch(':customerId')
    async updateCustomer(
        @Param('customerId') customerId: string,
        @Body() updateDto: CustomerUpdateDto
    ) {
        return this.service.updateCustomer(customerId, updateDto)
    }

    @Get(':customerId')
    async getCustomer(@Param('customerId') customerId: string) {
        return this.service.getCustomer(customerId)
    }

    @Delete(':customerId')
    async deleteCustomer(@Param('customerId') customerId: string) {
        return this.service.deleteCustomer(customerId)
    }

    @UsePipes(DefaultPaginationPipe)
    @Get()
    async findCustomers(@Query() queryDto: CustomerQueryDto) {
        return this.service.findCustomers(queryDto)
    }

    @UseGuards(CustomerLocalAuthGuard)
    @HttpCode(HttpStatus.OK)
    @Post('login')
    async login(@Req() req: { user: AuthTokenPayload }) {
        Assert.defined(req.user, 'req.user must be returned in LocalStrategy.validate')

        return this.service.login(req.user.userId, req.user.email)
    }

    @Public()
    @HttpCode(HttpStatus.OK)
    @Post('refresh')
    async refreshToken(@Body('refreshToken') refreshToken: string) {
        return this.service.refreshAuthTokens(refreshToken)
    }
}
