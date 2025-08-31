import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    // For development, we'll use a simple SMTP configuration
    // In production, you'd use a proper email service like SendGrid, AWS SES, etc.
    this.transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com', // You can change this
      port: 587,
      secure: false,
      auth: {
        user: this.configService.get<string>('EMAIL_USER'),
        pass: this.configService.get<string>('EMAIL_PASS'),
      },
      // For development/testing, we'll skip TLS verification
      tls: {
        rejectUnauthorized: false,
      },
    });
  }

  async sendInvitationEmail(
    to: string,
    senderName: string,
    conversationTitle: string,
    invitationId: string,
  ): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:4040';
    const acceptUrl = `${frontendUrl}/invitations?id=${invitationId}&action=accept`;
    const declineUrl = `${frontendUrl}/invitations?id=${invitationId}&action=decline`;

    const mailOptions = {
      from: this.configService.get<string>('EMAIL_FROM') || 'noreply@collaborativechat.com',
      to,
      subject: `Invitation to join "${conversationTitle}" conversation`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2563eb;">You've been invited to collaborate!</h2>
          
          <p>Hi there,</p>
          
          <p><strong>${senderName}</strong> has invited you to join the conversation "<strong>${conversationTitle}</strong>" on Collaborative AI Chat.</p>
          
          <p>Join the conversation to chat with AI and collaborate with other team members in real-time.</p>
          
          <div style="margin: 30px 0; text-align: center;">
            <a href="${acceptUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-right: 10px; display: inline-block;">Accept Invitation</a>
            <a href="${declineUrl}" style="background-color: #6b7280; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Decline</a>
          </div>
          
          <p style="color: #6b7280; font-size: 14px;">If you don't have an account yet, you'll need to register first before accepting the invitation.</p>
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
          
          <p style="color: #9ca3af; font-size: 12px;">
            This invitation was sent by ${senderName}. If you didn't expect this invitation, you can safely ignore this email.
          </p>
        </div>
      `,
      text: `
        You've been invited to collaborate!
        
        ${senderName} has invited you to join the conversation "${conversationTitle}" on Collaborative AI Chat.
        
        Accept: ${acceptUrl}
        Decline: ${declineUrl}
        
        If you don't have an account yet, you'll need to register first before accepting the invitation.
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`Invitation email sent to ${to}`);
    } catch (error) {
      console.error('Failed to send invitation email:', error);
      // For development, we'll just log the error instead of throwing
      // In production, you might want to throw the error or handle it differently
      console.log('Email content that would have been sent:');
      console.log('To:', to);
      console.log('Subject:', mailOptions.subject);
      console.log('Accept URL:', acceptUrl);
      console.log('Decline URL:', declineUrl);
    }
  }
} 