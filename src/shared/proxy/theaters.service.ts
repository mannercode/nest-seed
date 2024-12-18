import { Injectable } from '@nestjs/common'
import { ClientProxyService, getProxyValue, InjectClientProxy, MethodLog } from 'common'
import { TheaterCreateDto, TheaterDto, TheaterQueryDto, TheaterUpdateDto } from 'types'

@Injectable()
export class TheatersService {
    constructor(@InjectClientProxy('SERVICES_CLIENT') private service: ClientProxyService) {}

    @MethodLog({ level: 'verbose' })
    createTheater(createDto: TheaterCreateDto): Promise<TheaterDto> {
        return getProxyValue(this.service.send('createTheater', createDto))
    }

    @MethodLog({ level: 'verbose' })
    updateTheater(theaterId: string, updateDto: TheaterUpdateDto): Promise<TheaterDto> {
        return getProxyValue(this.service.send('updateTheater', { theaterId, updateDto }))
    }

    @MethodLog({ level: 'verbose' })
    getTheater(theaterId: string): Promise<TheaterDto> {
        return getProxyValue(this.service.send('getTheater', theaterId))
    }

    @MethodLog({ level: 'verbose' })
    deleteTheater(theaterId: string): Promise<boolean> {
        return getProxyValue(this.service.send('deleteTheater', theaterId))
    }

    @MethodLog({ level: 'verbose' })
    findTheaters(queryDto: TheaterQueryDto): Promise<TheaterDto[]> {
        return getProxyValue(this.service.send('findTheaters', queryDto))
    }

    @MethodLog({ level: 'verbose' })
    getTheatersByIds(theaterIds: string[]): Promise<TheaterDto[]> {
        return getProxyValue(this.service.send('getTheatersByIds', theaterIds))
    }

    @MethodLog({ level: 'verbose' })
    theatersExist(theaterIds: string[]): Promise<boolean> {
        return getProxyValue(this.service.send('theatersExist', theaterIds))
    }
}
