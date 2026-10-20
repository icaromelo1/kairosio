import { MigrationInterface, QueryRunner } from 'typeorm';

export class AparenciaDoPersonagem1792452839056 implements MigrationInterface {
  name = 'AparenciaDoPersonagem1792452839056';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "characters" ADD "aparencia" jsonb`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "characters" DROP COLUMN "aparencia"`);
  }
}
