import { IsString, MaxLength } from 'class-validator';

/**
 * Data Transfer Object for updating a conversation's title.  Only
 * the title may be updated at this time.  Validation ensures a
 * string no longer than 255 characters.
 */
export class UpdateConversationDto {
  /**
   * New title for the conversation.
   */
  @IsString()
  @MaxLength(255)
  title: string;
}