import { BadRequestException, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Character } from './character.entity'
import { AvatarPhotoStorageService } from './avatar-photo-storage.service'

const PHOTO_MAX_BYTES = 5 * 1024 * 1024 // 5MB
const PHOTO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
}

@Injectable()
export class CharacterService {
  constructor(
    @InjectRepository(Character) private repo: Repository<Character>,
    private readonly photoStorage: AvatarPhotoStorageService,
  ) {}

  async get(userId: string) {
    return this.repo.findOne({ where: { user: { id: userId } } })
  }

  async save(userId: string, data: Partial<Character>) {
    let char = await this.repo.findOne({ where: { user: { id: userId } } })
    if (char) {
      Object.assign(char, data)
    } else {
      char = this.repo.create({ ...data, user: { id: userId } as any })
    }
    return this.repo.save(char)
  }

  async savePhoto(userId: string, file: { buffer: Buffer; mimetype: string; size: number }) {
    const ext = PHOTO_EXT[file.mimetype]
    if (!ext) throw new BadRequestException('Formato inválido — use JPEG, PNG ou WEBP')
    if (file.size > PHOTO_MAX_BYTES) throw new BadRequestException('Foto muito grande — máximo 5MB')

    const old = (await this.get(userId))?.photoFile
    const fileName = `${userId}${ext}`
    this.photoStorage.writeLocal(fileName, file.buffer)
    await this.photoStorage.upload(fileName)
    if (old && old !== fileName) await this.photoStorage.deleteFile(old).catch(() => undefined)

    return this.save(userId, { photoFile: fileName })
  }

  async removePhoto(userId: string) {
    const char = await this.get(userId)
    if (char?.photoFile) await this.photoStorage.deleteFile(char.photoFile).catch(() => undefined)
    return this.save(userId, { photoFile: null })
  }

  async photoLocalPath(fileName: string) {
    return this.photoStorage.download(fileName)
  }
}
