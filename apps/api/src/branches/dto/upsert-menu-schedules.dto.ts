import { Type } from 'class-transformer';
import { ArrayUnique, IsArray, IsBoolean, IsInt, IsString, Max, Min, ValidateNested } from 'class-validator';

export class MenuScheduleItemDto {
  @IsString()
  menuId!: string;

  @IsBoolean()
  isActive!: boolean;

  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  @ArrayUnique()
  daysOfWeek!: number[];
}

export class UpsertMenuSchedulesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MenuScheduleItemDto)
  schedules!: MenuScheduleItemDto[];
}
