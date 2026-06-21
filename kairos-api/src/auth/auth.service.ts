import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcrypt'
import { User } from '../user/user.entity'

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    private jwtService: JwtService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.userRepo.findOne({ where: { email: email.trim().toLowerCase() } })
    if (!user || !user.password) throw new UnauthorizedException()
    const valid = await bcrypt.compare(password, user.password)
    if (!valid) throw new UnauthorizedException()
    return { token: this.jwtService.sign({ sub: user.id, email: user.email }) }
  }

  async register(email: string, password: string) {
    const normalized = email.trim().toLowerCase()
    const existing = await this.userRepo.findOne({ where: { email: normalized } })
    if (existing) throw new ConflictException('Email já cadastrado')
    const hashed = await bcrypt.hash(password, 10)
    const user = this.userRepo.create({ email: normalized, password: hashed })
    await this.userRepo.save(user)
    return { token: this.jwtService.sign({ sub: user.id, email: user.email }) }
  }

  async loginAsGuest() {
    const user = this.userRepo.create({ isGuest: true })
    await this.userRepo.save(user)
    return { token: this.jwtService.sign({ sub: user.id, isGuest: true }) }
  }

  async me(userId: string) {
    return this.userRepo.findOne({ where: { id: userId } })
  }
}
