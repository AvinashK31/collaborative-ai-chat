import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ChatOpenAI } from '@langchain/openai';
import { ConversationSummaryBufferMemory } from 'langchain/memory';
import { HumanMessage } from '@langchain/core/messages';
import { VectorService, EmbeddingDocument } from './vector.service';



/**
 * LangchainService orchestrates interactions with the OpenAI chat model
 * while respecting conversational context.  It dynamically
 * constructs prompts using the recent conversation history and
 * semantically similar past messages retrieved from a vector store.
 * Configuration for the model and other parameters is driven
 * entirely by environment variables, making it easy to change the
 * underlying model without code changes (for example, switching to
 * gpt‑5‑nano as the default).
 */
@Injectable()
export class LangchainService {
  /**
   * Primary ChatOpenAI instance.  Instantiated in the constructor
   * based on environment variables.  Kept private so callers do not
   * accidentally bypass prompt construction.
   */
  private llm: ChatOpenAI;
  /**
   * Cache of conversation memories, keyed by conversation ID.  Each
   * ConversationSummaryBufferMemory summarises long conversations to
   * avoid exceeding token limits.
   */
  private memoryCache = new Map<string, ConversationSummaryBufferMemory>();

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private vectorService: VectorService,
  ) {
    // Compute LLM configuration.  Use responses API and max completion tokens
    // when the model belongs to a newer family, otherwise use the legacy
    // chat completion parameters.  Temperature is omitted when not
    // supported (e.g. for deterministic reasoning models like gpt‑5‑nano).
    const { apiKey, model, temperature, maxTokens, maxCompletionTokens, useResponsesApi } = this.computeLlmConfig();
    const options: Record<string, unknown> = { apiKey, model };
    if (useResponsesApi) {
      options.useResponsesApi = true;
      options.maxCompletionTokens = maxCompletionTokens;
      if (temperature != null) options.temperature = temperature;
    } else {
      options.maxTokens = maxTokens;
      if (temperature != null) options.temperature = temperature;
    }
    this.llm = new ChatOpenAI(options);
  }

  /**
   * Return a high‑level description of the current model configuration.
   * Useful for diagnostics and for the API endpoint served by the
   * LangchainController.  It does not expose any secrets (API key).
   */
  getModelConfig() {
    const model = (this.configService.get<string>('OPENAI_MODEL') || 'gpt-5-nano').trim();
    const usesResponsesApi = this.isResponsesModel(model);
    const temperatureIncluded = this.isTemperatureSupported(model);
    const maxTokensConfigured = this.configService.get<number>('OPENAI_MAX_TOKENS') || 500;
    return {
      modelName: model,
      usesResponsesApi,
      temperatureIncluded,
      maxTokensConfigured,
    };
  }

  /**
   * Public API: produce a complete AI response for a message.  The
   * function constructs a prompt using conversation history and
   * semantic search results, invokes the underlying model and returns
   * the generated text.  The conversation memory and vector store
   * are updated accordingly.
   */
  async generateResponse(conversationId: string, message: string): Promise<string> {
    try {
      const memory = await this.getConversationMemory(conversationId);
      const history = await this.getConversationHistory(conversationId);
      const similar = await this.vectorService.searchSimilarMessages(conversationId, message, 5);
      const similarText = similar
        .map((result) => {
          const [doc, score] = result;
          const page = (doc as EmbeddingDocument).pageContent;
          const s = score as number;
          return `Similar (${s.toFixed(2)}): ${page}`;
        })
        .join('\n');
      const prompt = this.buildPrompt(`${history}\n${similarText}`, message);
      const res = await this.llm.invoke([new HumanMessage(prompt)]);
      const aiResponse = this.normalizeContent(res.content);
      await memory.saveContext({ input: message }, { output: aiResponse });
      // Store the AI message embedding.  A synthetic ID is used as the
      // message ID here because the messages table is updated in the
      // MessagesService; this ensures the embedding is still persisted.
      await this.vectorService.addMessageEmbedding(`ai-${Date.now()}`, conversationId, aiResponse);
      return aiResponse || '';
    } catch (error: unknown) {
      // Detect configuration errors to return a helpful message
      const err = error as { message?: unknown };
      const msg = String(err?.message ?? '').toLowerCase();
      if (msg.includes('max_tokens') || msg.includes('max_completion_tokens') || msg.includes('unsupported') || msg.includes('temperature')) {
        return 'I apologize, but there seems to be a configuration issue with the AI model. Please contact support.';
      }
      console.error('LangchainService error:', error);
      return 'I\'m sorry—something went wrong while processing your message. Please try again.';
    }
  }

  /**
   * Public API: produce a streaming AI response.  Similar to
   * generateResponse but yields tokens as they arrive.  Updates
   * conversation memory and vector store once streaming is complete.
   */
  async *generateStreamingResponse(conversationId: string, message: string): AsyncGenerator<string, void, unknown> {
    let full = '';
    try {
      const memory = await this.getConversationMemory(conversationId);
      const history = await this.getConversationHistory(conversationId);
      const similar = await this.vectorService.searchSimilarMessages(conversationId, message, 5);
      const similarText = similar
        .map((result) => {
          const [doc, score] = result;
          const page = (doc as EmbeddingDocument).pageContent;
          const s = score as number;
          return `Similar (${s.toFixed(2)}): ${page}`;
        })
        .join('\n');
      const prompt = this.buildPrompt(`${history}\n${similarText}`, message);
      const stream = await this.llm.stream([new HumanMessage(prompt)]);
      for await (const chunk of stream) {
        const piece = this.normalizeContent(chunk.content);
        if (piece) {
          full += piece;
          yield piece;
        }
      }
      await memory.saveContext({ input: message }, { output: full });
      await this.vectorService.addMessageEmbedding(`ai-${Date.now()}`, conversationId, full);
    } catch (error: unknown) {
      const err = error as { message?: unknown };
      const msg = String(err?.message ?? '').toLowerCase();
      if (msg.includes('max_tokens') || msg.includes('max_completion_tokens') || msg.includes('unsupported') || msg.includes('temperature')) {
        yield 'I apologize, but there seems to be a configuration issue with the AI model. Please contact support.';
        return;
      }
      console.error('LangchainService streaming error:', error);
      yield 'I\'m sorry—something went wrong while processing your message. Please try again.';
    }
  }

  /**
   * Derive the low‑level configuration required to instantiate
   * ChatOpenAI.  Handles differences between response models (which
   * use maxCompletionTokens) and legacy chat completion models (which
   * use maxTokens).  Temperature is only included when the model
   * supports it.
   */
  private computeLlmConfig() {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    const model = (this.configService.get<string>('OPENAI_MODEL') || 'gpt-5-nano').trim();
    const temperatureEnv = this.configService.get<number>('OPENAI_TEMPERATURE');
    const maxOut = this.configService.get<number>('OPENAI_MAX_TOKENS') || 500;
    const useResponsesApi = this.isResponsesModel(model);
    const supportsTemp = this.isTemperatureSupported(model);
    return {
      apiKey,
      model,
      temperature: supportsTemp ? temperatureEnv ?? 0.7 : null,
      maxTokens: useResponsesApi ? undefined : maxOut,
      maxCompletionTokens: useResponsesApi ? maxOut : undefined,
      useResponsesApi,
    };
  }

  /**
   * Determine whether the model belongs to the newer family that
   * requires the Responses API semantics.  These models include
   * gpt‑5, gpt‑4o, o4 and o3 families.
   */
  private isResponsesModel(model: string): boolean {
    const m = model.toLowerCase();
    return m.startsWith('gpt-5') || m.startsWith('gpt-4o') || m.startsWith('o4') || m.startsWith('o3');
  }

  /**
   * Determine whether the model supports the temperature parameter.
   * Certain deterministic models (e.g. gpt‑5‑nano) reject a
   * temperature value.
   */
  private isTemperatureSupported(model: string): boolean {
    const m = model.toLowerCase();
    if (m.startsWith('gpt-5-nano')) return false;
    if (m.startsWith('o3')) return false;
    return true;
  }

  /**
   * Get recent conversation history for context.  The result length is tuned 
   * relative to the configured maximum token budget to avoid exceeding limits.
   */
  private async getConversationHistory(conversationId: string): Promise<string> {
    try {
      // Fetch recent messages for context
      const msgs = await this.prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { user: { select: { id: true, email: true, name: true } } },
      });
      if (!msgs.length) return 'No previous conversation.';
      const chronological = msgs.reverse();
      // Assemble readable history
      return chronological
        .map((msg) => {
          const userName = msg.user?.name || msg.user?.email || 'Unknown User';
          if (msg.type === 'USER') return `User (${userName}): ${msg.content}`;
          if (msg.type === 'AI') return `AI Assistant: ${msg.content}`;
          return `System: ${msg.content}`;
        })
        .join('\n');
    } catch (err) {
      console.error('getConversationHistory error:', err);
      return 'Error loading conversation history.';
    }
  }

  /**
   * Build a prompt by combining conversation history, similar
   * messages and the current user message, along with guiding
   * instructions.
   */
  private buildPrompt(conversationHistory: string, currentMessage: string): string {
    return `You are an AI assistant in a collaborative chat. You should use the conversation history below to provide contextually relevant responses.\n\nConversation history:\n${conversationHistory}\n\nCurrent user message: ${currentMessage}\n\nInstructions:\n- Use the conversation history above to understand the context.\n- Reference previous topics and discussions when relevant.\n- Maintain consistency with the ongoing conversation.\n- Be concise, specific and helpful.\n\nAI Assistant:`;
  }

  /**
   * Retrieve or create the ConversationSummaryBufferMemory for a
   * conversation.  Memory stores summarised conversation context
   * enabling the model to handle long‑running chats without exceeding
   * token limits.  The memory uses the same LLM instance for
   * summarisation.
   */
  private async getConversationMemory(conversationId: string): Promise<ConversationSummaryBufferMemory> {
    if (this.memoryCache.has(conversationId)) return this.memoryCache.get(conversationId)!;
    const memory = new ConversationSummaryBufferMemory({
      llm: this.llm,
      maxTokenLimit: 1000,
      returnMessages: true,
      memoryKey: 'history',
      inputKey: 'input',
      outputKey: 'output',
    });
    try {
      const msgs = await this.prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
        take: 50,
      });
      for (let i = 0; i < msgs.length; i++) {
        const m = msgs[i];
        if (m.type === 'USER') {
          const nextAi = msgs.find((x, idx) => idx > i && x.type === 'AI');
          if (nextAi) {
            await memory.saveContext({ input: m.content }, { output: nextAi.content });
          }
        }
      }
      this.memoryCache.set(conversationId, memory);
    } catch (err) {
      console.error('getConversationMemory error:', err);
    }
    return memory;
  }

  /**
   * Normalise content returned by LangChain.  Content may be a
   * string, an array of structured objects or other types.  This
   * helper ensures a simple string is returned.
   */
  private normalizeContent(content: unknown): string {
    // If already a string just return it
    if (typeof content === 'string') return content;
    // If an array, join the textual representations of each element.
    if (Array.isArray(content)) {
      return content
        .map((c) => {
          // If element is an object with a `text` property, use that when it is a string
          if (typeof c === 'object' && c !== null && 'text' in c) {
            const maybeObj = c as { text?: unknown };
            if (typeof maybeObj.text === 'string') {
              return maybeObj.text;
            }
          }
          // If element is a string itself, return it
          if (typeof c === 'string') {
            return c;
          }
          // Otherwise return empty string
          return '';
        })
        .join('');
    }
    // For other object types, use their toString implementation when available
    if (content && typeof content === 'object' && typeof (content as { toString?: () => string }).toString === 'function') {
      // Cast to object with potential toString method and call it safely
      const obj = content as { toString: () => string };
      return obj.toString();
    }
    // Fallback: return empty string
    return '';
  }
}
