import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

/**
 * An embedding document returned from the vector store.  Only the
 * properties accessed by this service are declared here.  Additional
 * fields may be present in the actual document returned by
 * LangChain.
 */
export interface EmbeddingDocument {
  pageContent: string;
  metadata: Record<string, unknown>;
}

/**
 * A minimal interface for a vector store.  Implementations must
 * support adding documents and performing similarity searches with
 * scores.  Using this interface avoids the use of the `any` type
 * throughout this service.
 */
export interface VectorStore {
  /**
   * Add one or more documents to the underlying vector store.  The
   * return type is intentionally broad (`Promise<unknown>`) because
   * different store implementations (e.g. Chroma) return different
   * types (such as arrays of inserted IDs).  The service does not
   * depend on the return value, so it is safe to ignore.
   */
  addDocuments(documents: EmbeddingDocument[]): Promise<unknown>;
  /**
   * Perform a similarity search against the store, returning up to `k`
   * documents paired with their similarity score.  The optional
   * metadata filter can be used to scope the search to a specific
   * conversation or other criteria.
   */
  similaritySearchWithScore(
    query: string,
    k: number,
    filter?: Record<string, unknown>,
  ): Promise<[EmbeddingDocument, number][]>;
}

/*
 * VectorService encapsulates operations for storing and retrieving
 * semantically meaningful message embeddings using a vector store.  This
 * service can be backed by different providers depending on your
 * deployment.  For example, in development you may wish to use the
 * built‑in in‑memory store provided by LangChain, while in production
 * you may choose a persistent store such as ChromaDB or Weaviate.
 *
 * The provider is configured via the `VECTOR_DB_PROVIDER` environment
 * variable.  Supported values include:
 *
 *   - `memory` (default): uses the in‑memory store from LangChain.
 *   - `chroma`: uses the Chroma vector database.  Requires the
 *     appropriate dependencies and a running Chroma instance.  The
 *     connection settings can be supplied via additional environment
 *     variables, e.g. `VECTOR_DB_URL`.
 *
 * Each document added to the store includes metadata that links the
 * embedding back to the message and conversation it came from.  When
 * performing a similarity search the optional filter can be used to
 * limit results to a particular conversation.
 */
@Injectable()
export class VectorService {
  private readonly logger = new Logger(VectorService.name);
  /**
   * The underlying vector store.  This may be an in‑memory store
   * (MemoryVectorStore) or an external store such as Chroma.  The
   * VectorStore interface defined below captures only the methods
   * used by this service and avoids the use of the `any` type.
   */
  private vectorStore!: VectorStore;
  /**
   * Embeddings instance used to compute vector representations of
   * messages.  The type is unknown here to avoid the use of `any`
   * because OpenAIEmbeddings is not available at compile time.
   */
  private embeddings: unknown;

  constructor(private configService: ConfigService, private prisma: PrismaService) {
    this.initializeStore().catch((err) => {
      this.logger.error('Failed to initialise vector store', err);
    });
  }

  /**
   * Initialise the vector store based on configuration.  If the
   * configured provider cannot be resolved the service falls back to
   * the in‑memory store.  This method is idempotent and may be
   * called multiple times.
   */
  private async initializeStore() {
    const provider = (this.configService.get('VECTOR_DB_PROVIDER') || 'memory').toLowerCase();
    // Lazily import embeddings and vector stores to avoid pulling
    // unnecessary code into the bundle when not in use.
    const { OpenAIEmbeddings } = await import('langchain/embeddings/openai');
    const { MemoryVectorStore } = await import('langchain/vectorstores/memory');
    // Create embeddings instance.  Uses the same OpenAI API key as
    // configured for ChatOpenAI.  Should you wish to use a different
    // embeddings provider this can be swapped here.
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    this.embeddings = new OpenAIEmbeddings({ openAIApiKey: apiKey });

    // Determine which store to use.  Additional providers can be added
    // here by extending the conditional logic and importing the
    // appropriate LangChain vector store.
    if (provider === 'chroma') {
      try {
        const { Chroma } = await import('langchain/vectorstores/chroma');
        const collectionName = this.configService.get<string>('VECTOR_DB_COLLECTION') || 'messages';
        const url = this.configService.get<string>('VECTOR_DB_URL') || undefined;
        // Cast embeddings to any because the EmbeddingsInterface type is
        // not available at compile time and the constructor accepts a
        // generic embeddings instance.  This avoids TypeScript errors
        // while still preserving runtime behaviour.
        this.vectorStore = (await Chroma.fromExistingCollection(this.embeddings as any, {
          collectionName,
          url,
        })) as unknown as VectorStore;
        this.logger.log(`Vector store initialised with Chroma (collection: ${collectionName})`);
        return;
      } catch (err) {
        this.logger.warn('Chroma provider selected but failed to initialise, falling back to memory store', err);
      }
    }
    // Default: in‑memory vector store
    this.vectorStore = (await MemoryVectorStore.fromTexts([], [], this.embeddings as any)) as unknown as VectorStore;
    this.logger.log('Vector store initialised with in‑memory provider');
  }

  /**
   * Persist an embedding for a message.  This should be called
   * whenever a new message is created to enable semantic search over
   * conversation history.  The metadata object stores the message and
   * conversation identifiers, enabling filtered searches.
   *
   * @param messageId The unique identifier of the message
   * @param conversationId The unique identifier of the conversation
   * @param content The textual content of the message
   */
  async addMessageEmbedding(messageId: string, conversationId: string, content: string): Promise<void> {
    if (!content) return;
    try {
      // Each document comprises the pageContent and metadata.  The
      // metadata must include the identifiers to support filtering.
      const { Document } = await import('@langchain/core/documents');
      const documents: EmbeddingDocument[] = [
        new Document({
          pageContent: content,
          metadata: { messageId, conversationId },
        }) as unknown as EmbeddingDocument,
      ];
      await this.vectorStore.addDocuments(documents);
    } catch (err) {
      this.logger.warn(`Failed to add message embedding for ${messageId}`, err);
    }
  }

  /**
   * Retrieve the most semantically similar messages in a conversation.
   * When a filter is provided the search is limited to messages whose
   * metadata matches the filter.  The search returns documents
   * accompanied by their similarity score.
   *
   * @param conversationId The conversation to search within
   * @param query The message content to use as the search query
   * @param k The maximum number of results to return
   */
  async searchSimilarMessages(conversationId: string, query: string, k = 5): Promise<[EmbeddingDocument, number][]> {
    if (!query) return [];
    try {
      // Perform similarity search; filter by conversationId via metadata.
      const results = await this.vectorStore.similaritySearchWithScore(query, k, {
        conversationId,
      });
      return results;
    } catch (err) {
      this.logger.warn(`Failed to search similar messages for conversation ${conversationId}`, err);
      return [];
    }
  }
}
