import { ApiProperty } from '@nestjs/swagger';
import {
  IsMongoId,
  IsNumber,
  IsPositive,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateTransactionDto {
  @ApiProperty({
    example: 'Sunset Park 2BR sale',
    minLength: 3,
    maxLength: 160,
  })
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  title!: string;

  @ApiProperty({
    description: 'Total commission fee in TRY.',
    example: 120000,
    minimum: 0.01,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  totalFee!: number;

  @ApiProperty({
    description: 'MongoDB ObjectId of the listing agent.',
    example: '65f0a7c1c8e4b10012345678',
  })
  @IsMongoId()
  listingAgent!: string;

  @ApiProperty({
    description: 'MongoDB ObjectId of the selling agent.',
    example: '65f0a7c1c8e4b10087654321',
  })
  @IsMongoId()
  sellingAgent!: string;
}
