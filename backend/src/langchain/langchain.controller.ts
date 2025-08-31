import { Controller, Get, UseGuards } from '@nestjs/common';
import { LangchainService } from './langchain.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('langchain')
@ApiBearerAuth('JWT-auth')
@Controller('langchain')
@UseGuards(JwtAuthGuard)
export class LangchainController {
  constructor(private langchainService: LangchainService) {}

  @Get('config')
  @ApiOperation({
    summary: 'Get current model configuration',
    description:
      'Returns the AI model configuration in effect for the current environment, including the model name and token limits. Requires authentication.',
  })
  @ApiResponse({
    status: 200,
    description: 'Model configuration retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        modelName: { type: 'string' },
        usesResponsesApi: { type: 'boolean' },
        temperatureIncluded: { type: 'boolean' },
        maxTokensConfigured: { type: 'integer' },
      },
    },
  })
  async getModelConfig() {
    return this.langchainService.getModelConfig();
  }
}
