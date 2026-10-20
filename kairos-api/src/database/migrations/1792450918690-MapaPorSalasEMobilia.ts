import { MigrationInterface, QueryRunner } from 'typeorm';

export class MapaPorSalasEMobilia1792450918690 implements MigrationInterface {
  name = 'MapaPorSalasEMobilia1792450918690';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "game_maps" DROP COLUMN "width"`);
    await queryRunner.query(`ALTER TABLE "game_maps" DROP COLUMN "height"`);
    await queryRunner.query(`ALTER TABLE "game_maps" DROP COLUMN "palette"`);
    await queryRunner.query(`ALTER TABLE "game_maps" DROP COLUMN "objects"`);
    await queryRunner.query(`ALTER TABLE "game_maps" DROP COLUMN "blurb"`);
    await queryRunner.query(`ALTER TABLE "game_maps" DROP COLUMN "hours"`);
    await queryRunner.query(`ALTER TABLE "game_maps" DROP COLUMN "label"`);
    await queryRunner.query(
      `ALTER TABLE "game_maps" ADD "largura" real NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_maps" ADD "profundidade" real NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_maps" ADD "piso" character varying NOT NULL DEFAULT '#eadfc8'`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_maps" ADD "salas" jsonb NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_maps" ADD "mobilia" jsonb NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "game_maps" DROP COLUMN "mobilia"`);
    await queryRunner.query(`ALTER TABLE "game_maps" DROP COLUMN "salas"`);
    await queryRunner.query(`ALTER TABLE "game_maps" DROP COLUMN "piso"`);
    await queryRunner.query(
      `ALTER TABLE "game_maps" DROP COLUMN "profundidade"`,
    );
    await queryRunner.query(`ALTER TABLE "game_maps" DROP COLUMN "largura"`);
    await queryRunner.query(
      `ALTER TABLE "game_maps" ADD "label" character varying NOT NULL DEFAULT 'default'`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_maps" ADD "hours" character varying NOT NULL DEFAULT ''`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_maps" ADD "blurb" character varying NOT NULL DEFAULT ''`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_maps" ADD "objects" jsonb NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_maps" ADD "palette" jsonb NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_maps" ADD "height" integer NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_maps" ADD "width" integer NOT NULL`,
    );
  }
}
