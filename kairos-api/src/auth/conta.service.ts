import { Injectable } from '@nestjs/common'
import { DataSource, type EntityManager } from 'typeorm'

@Injectable()
export class ContaService {
  constructor(private readonly dataSource: DataSource) {}

  excluir(userId: string): Promise<void> {
    return this.dataSource.transaction(async (m) => {
      await this.repassarServidores(m, userId)
      await m.query(`DELETE FROM "dm_messages" WHERE "conversationId" IN (SELECT "id" FROM "dm_conversations" WHERE "userAId" = $1 OR "userBId" = $1)`, [userId])
      await m.query(`DELETE FROM "dm_conversations" WHERE "userAId" = $1 OR "userBId" = $1`, [userId])
      await m.query(`DELETE FROM "friendships" WHERE "userAId" = $1 OR "userBId" = $1`, [userId])
      await m.query(`DELETE FROM "friend_server_invites" WHERE "fromUserId" = $1 OR "toUserId" = $1`, [userId])
      await m.query(`DELETE FROM "server_memberships" WHERE "userId" = $1`, [userId])
      await m.query(`DELETE FROM "feedbacks" WHERE "authorId" = $1`, [userId])
      await m.query(`UPDATE "jukebox_tracks" SET "addedBy" = NULL, "addedByName" = 'conta excluída' WHERE "addedBy" = $1`, [userId])
      await m.query(`UPDATE "game_maps" SET "ownerId" = NULL WHERE "ownerId" = $1`, [userId])
      await m.query(`DELETE FROM "characters" WHERE "userId" = $1`, [userId])
      await m.query(`DELETE FROM "users" WHERE "id" = $1`, [userId])
    })
  }

  private async repassarServidores(m: EntityManager, userId: string) {
    const servidores: { id: string }[] = await m.query(`SELECT "id" FROM "servers" WHERE "ownerId" = $1`, [userId])
    for (const { id } of servidores) {
      const [herdeiro]: { userId: string }[] = await m.query(
        `SELECT "userId" FROM "server_memberships" WHERE "serverId" = $1 AND "userId" <> $2 ORDER BY ("role" = 'admin') DESC, "joinedAt" ASC LIMIT 1`,
        [id, userId],
      )
      if (herdeiro) {
        await m.query(`UPDATE "servers" SET "ownerId" = $1 WHERE "id" = $2`, [herdeiro.userId, id])
        await m.query(`UPDATE "server_memberships" SET "role" = 'admin' WHERE "serverId" = $1 AND "userId" = $2`, [id, herdeiro.userId])
        await m.query(`UPDATE "users" SET "serverRole" = 'admin' WHERE "id" = $1 AND "serverId" = $2`, [herdeiro.userId, id])
        continue
      }
      for (const tabela of ['tasks', 'notes', 'jukebox_tracks', 'server_invites', 'friend_server_invites', 'game_maps', 'server_memberships']) {
        await m.query(`DELETE FROM "${tabela}" WHERE "serverId" = $1`, [id])
      }
      await m.query(`UPDATE "users" SET "serverId" = NULL WHERE "serverId" = $1`, [id])
      await m.query(`DELETE FROM "servers" WHERE "id" = $1`, [id])
    }
  }
}
