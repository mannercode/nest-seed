import { Injectable } from '@nestjs/common'
import { ClientProxyService, getProxyValue, InjectClientProxy, MethodLog } from 'common'
import { TheaterCreateDto, TheaterDto, TheaterQueryDto, TheaterUpdateDto } from './dtos'

@Injectable()
export class TheatersProxy {
    constructor(@InjectClientProxy('clientProxy') private service: ClientProxyService) {}

    @MethodLog({ level: 'verbose' })
    createTheater(createDto: TheaterCreateDto): Promise<TheaterDto> {
        return getProxyValue(this.service.send('nestSeed.cores.theaters.createTheater', createDto))
    }

    @MethodLog({ level: 'verbose' })
    updateTheater(theaterId: string, updateDto: TheaterUpdateDto): Promise<TheaterDto> {
        return getProxyValue(
            this.service.send('nestSeed.cores.theaters.updateTheater', { theaterId, updateDto })
        )
    }

    @MethodLog({ level: 'verbose' })
    getTheater(theaterId: string): Promise<TheaterDto> {
        return getProxyValue(this.service.send('nestSeed.cores.theaters.getTheater', theaterId))
    }

    @MethodLog({ level: 'verbose' })
    deleteTheater(theaterId: string): Promise<boolean> {
        return getProxyValue(this.service.send('nestSeed.cores.theaters.deleteTheater', theaterId))
    }

    @MethodLog({ level: 'verbose' })
    findTheaters(queryDto: TheaterQueryDto): Promise<TheaterDto[]> {
        return getProxyValue(this.service.send('nestSeed.cores.theaters.findTheaters', queryDto))
    }

    @MethodLog({ level: 'verbose' })
    getTheatersByIds(theaterIds: string[]): Promise<TheaterDto[]> {
        return getProxyValue(this.service.send('nestSeed.cores.theaters.getTheatersByIds', theaterIds))
    }

    @MethodLog({ level: 'verbose' })
    theatersExist(theaterIds: string[]): Promise<boolean> {
        return getProxyValue(this.service.send('nestSeed.cores.theaters.theatersExist', theaterIds))
    }
}
