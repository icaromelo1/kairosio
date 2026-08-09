import { IsArray, IsBoolean, IsOptional, IsString, Matches } from 'class-validator'

// 256 = 16x16 pixels, um caractere por pixel, ordem de leitura (linha 0 esq->dir, depois linha 1...)
// alfabeto: . transparente, p pele, c cabelo, r roupa, o contorno
export class UpdateMascaraRevisaoDto {
  @IsOptional()
  @IsString()
  @Matches(/^[.pcro]{256}$/, {
    message: 'pixels deve ter exatamente 256 caracteres do alfabeto .pcro',
  })
  pixels?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  intencional?: string[]

  @IsOptional()
  @IsBoolean()
  duvida?: boolean

  @IsBoolean()
  revisado: boolean
}
