import path from 'node:path'
import { mkdir, readFile, writeFile } from 'node:fs/promises'

export interface StorageAdapter {
  putObject(input: { key: string; body: Buffer; contentType: string }): Promise<{ url: string }>
  getObject(input: { key: string }): Promise<Buffer>
}

function resolveKeyPath(rootDir: string, key: string): string {
  const safeKey = key.replace(/^\/+/, '')
  const normalizedRoot = path.resolve(rootDir)
  const fullPath = path.resolve(normalizedRoot, safeKey)
  const relativePath = path.relative(normalizedRoot, fullPath)

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error('Invalid storage key')
  }

  return fullPath
}

export class LocalDiskStorageAdapter implements StorageAdapter {
  private readonly rootDir: string

  constructor(rootDir: string) {
    this.rootDir = rootDir
  }

  async putObject(input: { key: string; body: Buffer; contentType: string }): Promise<{ url: string }> {
    const targetPath = resolveKeyPath(this.rootDir, input.key)
    await mkdir(path.dirname(targetPath), { recursive: true })
    await writeFile(targetPath, input.body)

    return { url: `file://${targetPath}` }
  }

  async getObject(input: { key: string }): Promise<Buffer> {
    const targetPath = resolveKeyPath(this.rootDir, input.key)
    return readFile(targetPath)
  }
}
