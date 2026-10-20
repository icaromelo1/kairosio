import { MigrationInterface, QueryRunner } from 'typeorm';

export class AreasDoMapa1792465329054 implements MigrationInterface {
  name = 'AreasDoMapa1792465329054';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "game_maps" ADD "areas" jsonb NOT NULL DEFAULT '[]'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "game_maps" DROP COLUMN "areas"`);
  }
}
