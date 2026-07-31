import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcrypt'
import { User } from '../user/user.entity'
import { ServerMembership } from '../server/server-membership.entity'

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(ServerMembership) private serverMembershipRepo: Repository<ServerMembership>,
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
    // sufixo reservado pro fallback do OAuth GitHub (contas sem email público) —
    // registrar um @github.local por senha permitiria sequestrar essa conta
    if (normalized.endsWith('@github.local')) throw new ConflictException('Email não permitido')
    const existing = await this.userRepo.findOne({ where: { email: normalized } })
    if (existing) throw new ConflictException('Email já cadastrado')
    const hashed = await bcrypt.hash(password, 10)
    const user = this.userRepo.create({ email: normalized, password: hashed })
    await this.userRepo.save(user)
    return { token: this.jwtService.sign({ sub: user.id, email: user.email }) }
  }

  // login via OAuth (Google/GitHub): acha ou cria o usuário pelo email
  async oauthLogin(email: string) {
    const normalized = email.trim().toLowerCase()
    let user = await this.userRepo.findOne({ where: { email: normalized } })
    if (!user) {
      user = this.userRepo.create({ email: normalized })
      await this.userRepo.save(user)
    }
    return { token: this.jwtService.sign({ sub: user.id, email: user.email }) }
  }

  async loginAsGuest() {
    const user = this.userRepo.create({ isGuest: true })
    await this.userRepo.save(user)
    return { token: this.jwtService.sign({ sub: user.id, isGuest: true }) }
  }

  async me(userId: string) {
    return this.userRepo.findOne({
      where: { id: userId },
      select: ['id', 'email', 'isGuest', 'serverId', 'serverRole', 'createdAt'],
    })
  }

  // convidado nunca fica pra trás no banco: ao sair (botão "Sair"), se for
  // isGuest, apaga a conta inteira. Character/WorldState vão junto via
  // onDelete: CASCADE na FK; server_memberships é coluna solta (sem FK real),
  // então limpa manualmente pra não deixar vínculo órfão.
  async logout(userId: string): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } })
    if (!user?.isGuest) return
    await this.serverMembershipRepo.delete({ userId })
    await this.userRepo.delete(userId)
  }
}
