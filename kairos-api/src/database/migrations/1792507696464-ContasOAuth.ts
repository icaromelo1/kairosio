import { MigrationInterface, QueryRunner } from 'typeorm';

export class ContasOAuth1792507696464 implements MigrationInterface {
  name = 'ContasOAuth1792507696464';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "googleId" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "UQ_f382af58ab36057334fb262efd5" UNIQUE ("googleId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "githubId" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "UQ_42148de213279d66bf94b363bf2" UNIQUE ("githubId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "UQ_42148de213279d66bf94b363bf2"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "githubId"`);
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "UQ_f382af58ab36057334fb262efd5"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "googleId"`);
  }
}
