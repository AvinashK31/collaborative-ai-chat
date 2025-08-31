import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  /**
   * Validate the JWT payload.  The payload is expected to include a
   * `userId` property.  If the user cannot be resolved an
   * UnauthorizedException is thrown.
   *
   * @param payload The decoded JWT payload
   */
  async validate(payload: JwtPayload): Promise<unknown> {
    const user = await this.authService.validateUser(payload.userId);
    if (!user) {
      throw new UnauthorizedException();
    }
    return user;
  }
} 

/**
 * The shape of the JWT payload used by this application.  Only the
 * userId is required here.  Additional claims can be added as
 * needed.
 */
export interface JwtPayload {
  userId: string;
  [key: string]: unknown;
}