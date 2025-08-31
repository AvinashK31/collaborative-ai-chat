import { IsEmail, IsString } from 'class-validator';

/**
 * Data Transfer Object for creating a new invitation.  Validates
 * that the invitee email address is well‑formed and that the
 * conversation ID is supplied.  Use this DTO with `@Body()` in
 * controllers to enforce input correctness.
 */
export class CreateInvitationDto {
  /**
   * Email address of the user to invite.  Must be a valid email
   * format.
   */
  @IsEmail()
  email: string;

  /**
   * Identifier of the conversation to which the user is being
   * invited.
   */
  @IsString()
  conversationId: string;
}