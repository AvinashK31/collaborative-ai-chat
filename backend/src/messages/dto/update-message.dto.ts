import { IsString } from 'class-validator';

/**
 * Data Transfer Object for updating an existing message.  Only the
 * content may be updated; the author and type cannot be changed.
 */
export class UpdateMessageDto {
  /**
   * The new content to replace the existing message text.
   */
  @IsString()
  content: string;
}