import { IsOptional, IsString, MaxLength, IsArray, IsEmail } from 'class-validator';

/**
 * Data Transfer Object for creating a new conversation.
 *
 * The title is optional and limited to 255 characters.  A list of
 * participant emails may be provided when creating a conversation to
 * invite additional users.  The emails are validated using the
 * built‑in email validator.  This DTO should be used with
 * `@Body()` in controllers to ensure incoming requests are
 * validated and typed correctly.
 */
export class CreateConversationDto {
  /**
   * Optional title of the conversation.  Defaults to "New
   * Conversation" when omitted.
   */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  /**
   * Optional array of email addresses to invite as participants.
   */
  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  participantEmails?: string[];
}