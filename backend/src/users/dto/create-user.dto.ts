import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { UserRole } from '../enums/user-role.enum';

export class CreateUserDto {
  @ApiProperty({ example: 'Ayşe Demir', minLength: 2, maxLength: 80 })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @ApiProperty({ example: 'ayse@firma.com', maxLength: 120, format: 'email' })
  @IsEmail()
  @MaxLength(120)
  email!: string;

  @ApiProperty({ example: 'Secret123', minLength: 6, maxLength: 128 })
  @IsString()
  @MinLength(6)
  @MaxLength(128)
  password!: string;

  @ApiPropertyOptional({
    enum: UserRole,
    default: UserRole.AGENT,
    description: 'Defaults to AGENT when omitted.',
  })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}
