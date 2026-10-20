import { MigrationInterface, QueryRunner } from 'typeorm';

export class Inicial1792449961097 implements MigrationInterface {
  name = 'Inicial1792449961097';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying, "password" character varying, "username" character varying, "usernameLower" character varying, "usernameChangedAt" TIMESTAMP WITH TIME ZONE, "isGuest" boolean NOT NULL DEFAULT false, "isSudo" boolean NOT NULL DEFAULT false, "serverId" uuid, "serverRole" character varying NOT NULL DEFAULT 'member', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "UQ_a641ed9694096426fd64a18169f" UNIQUE ("usernameLower"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "characters" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "photoFile" character varying, "userId" uuid, CONSTRAINT "REL_7c1bf02092d401b55ecc243ef1" UNIQUE ("userId"), CONSTRAINT "PK_9d731e05758f26b9315dac5e378" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "game_maps" ("id" character varying NOT NULL, "name" character varying NOT NULL, "blurb" character varying NOT NULL DEFAULT '', "hours" character varying NOT NULL DEFAULT '', "label" character varying NOT NULL DEFAULT 'default', "width" integer NOT NULL, "height" integer NOT NULL, "palette" jsonb NOT NULL, "spawn" jsonb NOT NULL, "objects" jsonb NOT NULL, "ownerId" uuid, "serverId" uuid, "isTemplate" boolean NOT NULL DEFAULT false, "editadoEm" TIMESTAMP, CONSTRAINT "PK_ea74323645b1b265c7376ec4ca7" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "feedbacks" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "kind" character varying NOT NULL DEFAULT 'bug', "title" character varying NOT NULL, "message" text NOT NULL, "status" character varying NOT NULL DEFAULT 'aberto', "authorEmail" character varying NOT NULL, "authorId" uuid NOT NULL, "resolvedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_79affc530fdd838a9f1e0cc30be" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "servers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "slug" character varying NOT NULL, "ownerId" uuid NOT NULL, "archivedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_5c148a3e0a635fa398f28a1cc23" UNIQUE ("slug"), CONSTRAINT "PK_c0947efd9f3db2dcc010164d20b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "server_invites" ("code" character varying NOT NULL, "serverId" uuid NOT NULL, "createdBy" uuid NOT NULL, "expiresAt" TIMESTAMP, "maxUses" integer, "uses" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_d74d91f335ac724f10bef237f80" PRIMARY KEY ("code"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "server_memberships" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "serverId" uuid NOT NULL, "role" character varying NOT NULL DEFAULT 'member', "joinedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a1336f84cf475dc3b70be011c5f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "jukebox_tracks" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "youtubeId" character varying NOT NULL, "title" character varying NOT NULL, "durationSec" integer NOT NULL, "driveFile" character varying NOT NULL, "addedBy" uuid, "serverId" uuid, "addedByName" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "lastPlayedAt" TIMESTAMP, CONSTRAINT "UQ_e9e887598f4d9f2ea635a857830" UNIQUE ("youtubeId"), CONSTRAINT "PK_0d68a8cc9f555e3a6d751c168aa" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "tasks" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "mapId" character varying NOT NULL, "objectId" character varying NOT NULL, "serverId" uuid NOT NULL, "title" character varying NOT NULL, "done" boolean NOT NULL DEFAULT false, "createdBy" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_8d12ff38fcc62aaba2cab748772" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "notes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "mapId" character varying NOT NULL, "objectId" character varying NOT NULL, "serverId" uuid, "body" text NOT NULL, "createdBy" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_af6206538ea96c4e77e9f400c3d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "friendships" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userAId" uuid NOT NULL, "userBId" uuid NOT NULL, "status" character varying NOT NULL DEFAULT 'pendente', "requestedBy" uuid NOT NULL, "blockedBy" uuid, "respondedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_08af97d0be72942681757f07bc8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_929b33c240a0f0052be3212994" ON "friendships" ("userAId", "userBId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "friend_server_invites" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "serverId" uuid NOT NULL, "fromUserId" uuid NOT NULL, "toUserId" uuid NOT NULL, "status" character varying NOT NULL DEFAULT 'pendente', "respondedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_960005f87d6f097082824797341" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_718fc44c745bec0209ea8de3c7" ON "friend_server_invites" ("toUserId", "status") `,
    );
    await queryRunner.query(
      `CREATE TABLE "dm_conversations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userAId" uuid NOT NULL, "userBId" uuid NOT NULL, "readAAt" TIMESTAMP WITH TIME ZONE, "readBAt" TIMESTAMP WITH TIME ZONE, "lastMessageAt" TIMESTAMP WITH TIME ZONE, "lastMessageAuthorId" uuid, "lastMessagePreview" character varying(160), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_7bdbd625ee8afc40e14ec8bb10e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_def16acaeafe258e69eee1d0bc" ON "dm_conversations" ("userAId", "userBId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "dm_messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "conversationId" uuid NOT NULL, "authorId" uuid NOT NULL, "text" text NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_24b287ad446f01f5a364a277627" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_fc008746a5925ae287f58d6161" ON "dm_messages" ("authorId", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e570bf6cd682d2594551d5d448" ON "dm_messages" ("conversationId", "createdAt") `,
    );
    await queryRunner.query(
      `ALTER TABLE "characters" ADD CONSTRAINT "FK_7c1bf02092d401b55ecc243ef1f" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "characters" DROP CONSTRAINT "FK_7c1bf02092d401b55ecc243ef1f"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e570bf6cd682d2594551d5d448"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_fc008746a5925ae287f58d6161"`,
    );
    await queryRunner.query(`DROP TABLE "dm_messages"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_def16acaeafe258e69eee1d0bc"`,
    );
    await queryRunner.query(`DROP TABLE "dm_conversations"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_718fc44c745bec0209ea8de3c7"`,
    );
    await queryRunner.query(`DROP TABLE "friend_server_invites"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_929b33c240a0f0052be3212994"`,
    );
    await queryRunner.query(`DROP TABLE "friendships"`);
    await queryRunner.query(`DROP TABLE "notes"`);
    await queryRunner.query(`DROP TABLE "tasks"`);
    await queryRunner.query(`DROP TABLE "jukebox_tracks"`);
    await queryRunner.query(`DROP TABLE "server_memberships"`);
    await queryRunner.query(`DROP TABLE "server_invites"`);
    await queryRunner.query(`DROP TABLE "servers"`);
    await queryRunner.query(`DROP TABLE "feedbacks"`);
    await queryRunner.query(`DROP TABLE "game_maps"`);
    await queryRunner.query(`DROP TABLE "characters"`);
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
