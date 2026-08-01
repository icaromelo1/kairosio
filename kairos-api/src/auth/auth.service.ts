import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcrypt'
import { User } from '../user/user.entity'
import { ServerMembership } from '../server/server-membership.entity'
import { isAdminEmail } from './admin'
import {
  UsernameProblem,
  checkUsername,
  displayUsername,
  nextUsernameChangeAt,
  normalizeUsername,
} from '../user/username'

const UNIQUE_VIOLATION = '23505'

export interface UsernameStatus {
  disponivel: boolean
  motivo?: UsernameProblem | 'em-uso'
}

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

  async register(email: string, password: string, username: string) {
    const normalized = email.trim().toLowerCase()
    // sufixo reservado pro fallback do OAuth GitHub (contas sem email público) —
    // registrar um @github.local por senha permitiria sequestrar essa conta
    if (normalized.endsWith('@github.local')) throw new ConflictException('Email não permitido')
    this.assertUsernameAllowed(username)
    const name = displayUsername(username)
    const nameLower = normalizeUsername(username)

    const existing = await this.userRepo.findOne({ where: { email: normalized } })
    if (existing) throw this.emailTaken()
    const nameOwner = await this.userRepo.findOne({ where: { usernameLower: nameLower } })
    if (nameOwner) throw this.usernameTaken()

    const hashed = await bcrypt.hash(password, 10)
    const user = this.userRepo.create({
      email: normalized,
      password: hashed,
      username: name,
      usernameLower: nameLower,
    })
    await this.saveUnique(user)
    return { token: this.jwtService.sign({ sub: user.id, email: user.email }) }
  }

  async oauthLogin(email: string) {
    const normalized = email.trim().toLowerCase()
    let user = await this.userRepo.findOne({ where: { email: normalized } })
    if (!user) {
      user = this.userRepo.create({ email: normalized })
      await this.userRepo.save(user)
    }
    return { token: this.jwtService.sign({ sub: user.id, email: user.email }) }
  }

  async usernameStatus(raw: string): Promise<UsernameStatus> {
    const problem = checkUsername(raw)
    if (problem) return { disponivel: false, motivo: problem }
    const owner = await this.userRepo.findOne({ where: { usernameLower: normalizeUsername(raw) } })
    return owner ? { disponivel: false, motivo: 'em-uso' } : { disponivel: true }
  }

  async changeUsername(userId: string, raw: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } })
    if (!user) throw new UnauthorizedException()
    if (user.isGuest) {
      throw new ForbiddenException({
        code: 'guest-no-username',
        message: 'Convidado não tem nome de usuário. Crie uma conta pra ter o seu.',
      })
    }
    this.assertUsernameAllowed(raw)
    const name = displayUsername(raw)
    const nameLower = normalizeUsername(raw)

    if (user.usernameLower === nameLower) {
      if (user.username !== name) {
        user.username = name
        await this.userRepo.save(user)
      }
      return this.usernameView(user)
    }

    const next = nextUsernameChangeAt(user.usernameChangedAt)
    if (next && next.getTime() > Date.now()) {
      throw new ConflictException({
        code: 'username-cooldown',
        message: 'Você só pode trocar de nome de usuário a cada 30 dias.',
        proximaTrocaEm: next.toISOString(),
      })
    }

    const owner = await this.userRepo.findOne({ where: { usernameLower: nameLower } })
    if (owner) throw this.usernameTaken()

    const adotandoOPrimeiro = !user.usernameLower
    user.username = name
    user.usernameLower = nameLower
    if (!adotandoOPrimeiro) user.usernameChangedAt = new Date()
    await this.saveUnique(user)
    return this.usernameView(user)
  }

  async me(userId: string) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: [
        'id',
        'email',
        'username',
        'usernameChangedAt',
        'isGuest',
        'serverId',
        'serverRole',
        'createdAt',
      ],
    })
    if (!user) return null
    return { ...user, isAdmin: isAdminEmail(user.email) }
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

  private usernameView(user: User) {
    return {
      username: user.username,
      usernameChangedAt: user.usernameChangedAt ?? null,
      proximaTrocaEm: nextUsernameChangeAt(user.usernameChangedAt)?.toISOString() ?? null,
    }
  }

  private assertUsernameAllowed(raw: string) {
    const problem = checkUsername(raw)
    if (problem === 'reservado') {
      throw new BadRequestException({
        code: 'username-reserved',
        message: 'Esse nome de usuário é reservado pelo Kairos.',
      })
    }
    if (problem) {
      throw new BadRequestException({
        code: 'username-invalid',
        message:
          'Nome de usuário inválido: 3 a 20 caracteres, letras, números, ponto e sublinhado, sem começar ou terminar com ponto e sem pontos seguidos.',
      })
    }
  }

  private async saveUnique(user: User) {
    try {
      await this.userRepo.save(user)
    } catch (err: any) {
      if (err?.code !== UNIQUE_VIOLATION) throw err
      const alvo = String(err?.detail ?? '')
      throw alvo.toLowerCase().includes('username') ? this.usernameTaken() : this.emailTaken()
    }
  }

  private usernameTaken() {
    return new ConflictException({
      code: 'username-taken',
      message: 'Esse nome de usuário já está em uso.',
    })
  }

  private emailTaken() {
    return new ConflictException({ code: 'email-exists', message: 'Email já cadastrado' })
  }
}
