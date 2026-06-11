import { IsNumber, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class CreateExtraDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price!: number;
}
