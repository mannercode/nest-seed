import { MethodLog } from '../method-log'
import { Observable, of, throwError } from 'rxjs'

function CustomMetadataDecorator(value: string): MethodDecorator {
    return (target, propertyKey, descriptor) => {
        Reflect.defineMetadata('CUSTOM_KEY', value, descriptor.value!)
    }
}

export class TestService {
    @MethodLog()
    syncMethod(data: string) {
        return data
    }

    @MethodLog()
    async asyncMethod(data: string) {
        return data
    }

    @MethodLog()
    observableMethod(data: string): Observable<string> {
        return of(data)
    }

    @MethodLog()
    throwSyncError(data: string) {
        throw new Error(data)
    }

    @MethodLog()
    async throwAsyncError(data: string) {
        throw new Error(data)
    }

    @MethodLog()
    throwObservableError(data: string) {
        return throwError(() => new Error(data))
    }

    @MethodLog({ level: 'debug' })
    debugLog() {
        return 'value'
    }

    @MethodLog()
    @CustomMetadataDecorator('TEST_VALUE')
    nestedDecorator() {
        return 'value'
    }
}
