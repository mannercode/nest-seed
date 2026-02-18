import fs from 'fs/promises'
import { tmpdir } from 'os'
import p from 'path'

export class Path {
    static basename(path: string): string {
        return p.basename(path)
    }

    static async copy(src: string, dest: string): Promise<void> {
        await fs.cp(src, dest, { force: true, recursive: true })
    }

    static async createTempDirectory(): Promise<string> {
        return fs.mkdtemp(`${tmpdir()}${this.sep()}`)
    }

    static async delete(path: string): Promise<void> {
        await fs.rm(path, { force: true, recursive: true })
    }

    static dirname(path: string): string {
        return p.dirname(path)
    }

    static async exists(path: string): Promise<boolean> {
        try {
            await fs.access(path)

            return true
        } catch {
            return false
        }
    }

    static getAbsolute(src: string): string {
        return p.isAbsolute(src) ? src : p.resolve(src)
    }

    static async isDirectory(path: string): Promise<boolean> {
        const stats = await fs.stat(path)
        return stats.isDirectory()
    }

    static async isWritable(path: string): Promise<boolean> {
        try {
            await fs.access(path, fs.constants.W_OK)

            return true
        } catch {
            return false
        }
    }

    static join(...paths: string[]): string {
        return p.join(...paths)
    }

    static async mkdir(path: string): Promise<void> {
        await fs.mkdir(path, { recursive: true })
    }

    static async move(src: string, dest: string): Promise<void> {
        // rename may fail if moving to a different file-system
        try {
            await fs.rename(src, dest)
        } catch (error: unknown) {
            const exdev = (error as NodeJS.ErrnoException).code === 'EXDEV'
            if (!exdev) throw error

            await this.copy(src, dest)
            await this.delete(src)
        }
    }

    static sep() {
        return p.sep
    }

    static async subdirs(src: string): Promise<string[]> {
        const items = await fs.readdir(src, { withFileTypes: true })
        return items
            .filter((item) => item.isDirectory())
            .map((item) => item.name)
            .sort((left, right) => left.localeCompare(right))
    }
}
