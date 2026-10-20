import { MigrationInterface, QueryRunner } from 'typeorm';

export class TermosAceitos1792514468262 implements MigrationInterface {
  name = 'TermosAceitos1792514468262';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "termosAceitosEm" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "termosAceitosEm"`,
    );
  }
}
