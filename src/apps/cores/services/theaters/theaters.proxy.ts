import { Injectable } from '@nestjs/common'
import { ClientProxyService, InjectClientProxy, MethodLog } from 'common'
import { ClientProxyConfig, Messages } from 'shared/config'
import { TheaterCreateDto, TheaterDto, TheaterQueryDto, TheaterUpdateDto } from './dtos'

@Injectable()
export class TheatersProxy {
    constructor(
        @InjectClientProxy(ClientProxyConfig.connName) private service: ClientProxyService
    ) {}

    @MethodLog({ level: 'verbose' })
    createTheater(createDto: TheaterCreateDto): Promise<TheaterDto> {
        return this.service.getJson(Messages.Theaters.createTheater, createDto)
    }

    @MethodLog({ level: 'verbose' })
    updateTheater(theaterId: string, updateDto: TheaterUpdateDto): Promise<TheaterDto> {
        return this.service.getJson(Messages.Theaters.updateTheater, { theaterId, updateDto })
    }

    @MethodLog({ level: 'verbose' })
    getTheater(theaterId: string): Promise<TheaterDto> {
        return this.service.getJson(Messages.Theaters.getTheater, theaterId)
    }

    @MethodLog({ level: 'verbose' })
    deleteTheater(theaterId: string): Promise<boolean> {
        return this.service.getJson(Messages.Theaters.deleteTheater, theaterId)
    }

    @MethodLog({ level: 'verbose' })
    findTheaters(queryDto: TheaterQueryDto): Promise<TheaterDto[]> {
        return this.service.getJson(Messages.Theaters.findTheaters, queryDto)
    }

    @MethodLog({ level: 'verbose' })
    getTheatersByIds(theaterIds: string[]): Promise<TheaterDto[]> {
        return this.service.getJson(Messages.Theaters.getTheatersByIds, theaterIds)
    }

    @MethodLog({ level: 'verbose' })
    theatersExist(theaterIds: string[]): Promise<boolean> {
        return this.service.getJson(Messages.Theaters.theatersExist, theaterIds)
    }
}
