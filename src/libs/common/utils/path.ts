import p from 'path'

export class Path {
    static basename(path: string): string {
        return p.basename(path)
    }

    static dirname(path: string): string {
        return p.dirname(path)
    }

    static getAbsolute(src: string): string {
        return p.isAbsolute(src) ? src : p.resolve(src)
    }

    static join(...paths: string[]): string {
        return p.join(...paths)
    }

    static sep() {
        return p.sep
    }
}
