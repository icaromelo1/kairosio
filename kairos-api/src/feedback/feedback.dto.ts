import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

export class CreateFeedbackDto {
  @IsEmail()
  email: string

  @IsOptional()
  @IsIn(['bug', 'melhoria'])
  kind?: 'bug' | 'melhoria'

  @IsString()
  @MinLength(3)
  @MaxLength(120)
  title: string

  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  message: string
}

export class UpdateFeedbackStatusDto {
  @IsIn(['aberto', 'em_andamento', 'resolvido', 'recusado'])
  status: 'aberto' | 'em_andamento' | 'resolvido' | 'recusado'
}
