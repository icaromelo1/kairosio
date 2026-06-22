import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Organization } from './organization.entity'
import { OrgInvite } from './org-invite.entity'
import { User } from '../user/user.entity'
import { GameMap } from '../map/game-map.entity'
import { OrgService } from './org.service'
import { OrgController } from './org.controller'

@Module({
  imports: [TypeOrmModule.forFeature([Organization, OrgInvite, User, GameMap])],
  providers: [OrgService],
  controllers: [OrgController],
})
export class OrgModule {}
