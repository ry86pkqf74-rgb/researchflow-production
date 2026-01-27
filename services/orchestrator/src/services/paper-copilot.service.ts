/**
 * Paper Copilot Service (Track B Phase 12)
 *
 * RAG-based AI chat for paper/PDF analysis:
 * - Text chunking with embeddings
 * - Semantic search for relevant context
 * - Chat completion with retrieved context
 * - Summary and claim extraction
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';
import { createHash } from 'crypto';
import OpenAI from 'openai';

// =============================================================================
// Types
// =============================================================================

export interface TextChunk {
  text: string;
  pageNumber?: number;
  charStart: number;
  charEnd: number;
  tokenCount?: number;
}

export interface RetrievedChunk {
  id: string;
  chunkIndex: number;
  pageNumber: number | null;
  textContent: string;
  similarity: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatResponse {
  message: string;
  contextChunks: RetrievedChunk[];
  model: string;
  tokensInput: number;
  tokensOutput: number;
  latencyMs: number;
}

export interface SummaryResponse {
  summary: string;
  type: string;
  model: string;
}

export interface ClaimResponse {
  claims: Array<{
    text: string;
    type: string;
    pageNumber?: number;
    confidence: number;
  }>;
  model: string;
}

// =============================================================================
// Configuration
// =============================================================================

const CHUNK_SIZE = 1000; // characters per chunk
const CHUNK_OVERLAP = 200; // overlap between chunks
const EMBEDDING_MODEL = 'text-embedding-3-small';
const CHAT_MODEL = 'gpt-4o-mini';
const MAX_CONTEXT_CHUNKS = 5;
const MIN_SIMILARITY = 0.7;

// =============================================================================
// Paper Copilot Service Class
// =============================================================================

export class PaperCopilotService {
  private openai: OpenAI | null = null;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    }
  }

  // ===========================================================================
  // Text Chunking
  // ===========================================================================

  /**
   * Chunk paper text into overlapping segments
   */
  chunkText(fullText: string, pageBreaks?: number[]): TextChunk[] {
    const chunks: TextChunk[] = [];
    let position = 0;
    let chunkIndex = 0;

    while (position < fullText.length) {
      const end = Math.min(position + CHUNK_SIZE, fullText.length);

      // Try to break at sentence boundary
      let chunkEnd = end;
      if (end < fullText.length) {
        const slice = fullText.slice(position, end + 100);
        const sentenceEnd = this.findSentenceBreak(slice, CHUNK_SIZE);
        if (sentenceEnd > CHUNK_SIZE / 2) {
          chunkEnd = position + sentenceEnd;
        }
      }

      const chunkText = fullText.slice(position, chunkEnd);

      // Determine page number if we have page breaks
      let pageNumber: number | undefined;
      if (pageBreaks && pageBreaks.length > 0) {
        pageNumber = 1;
        for (let i = 0; i < pageBreaks.length; i++) {
          if (position >= pageBreaks[i]) {
            pageNumber = i + 2;
          }
        }
      }

      chunks.push({
        text: chunkText.trim(),
        pageNumber,
        charStart: position,
        charEnd: chunkEnd,
        tokenCount: Math.ceil(chunkText.length / 4), // rough estimate
      });

      // Move position with overlap
      position = chunkEnd - CHUNK_OVERLAP;
      if (position <= chunks[chunks.length - 1]?.charStart) {
        position = chunkEnd; // avoid infinite loop
      }
      chunkIndex++;
    }

    return chunks.filter(c => c.text.length > 50); // filter tiny chunks
  }

  /**
   * Find a good sentence break point
   */
  private findSentenceBreak(text: string, target: number): number {
    const sentenceEnders = ['. ', '! ', '? ', '.\n', '!\n', '?\n'];
    let lastBreak = -1;

    for (const ender of sentenceEnders) {
      let pos = 0;
      while ((pos = text.indexOf(ender, pos)) !== -1) {
        if (pos <= target + 50) {
          lastBreak = Math.max(lastBreak, pos + ender.length);
        }
        pos++;
      }
    }

    return lastBreak > 0 ? lastBreak : target;
  }

  // ===========================================================================
  // Embedding Generation
  // ===========================================================================

  /**
   * Generate embeddings for chunks and store in database
   */
  async chunkAndEmbedPaper(paperId: string): Promise<number> {
    if (!this.openai) {
      throw new Error('OpenAI API key not configured');
    }

    // Get paper text content
    const textResult = await db.execute(sql`
      SELECT page_number, text_content
      FROM paper_text_content
      WHERE paper_id = ${paperId}
      ORDER BY page_number
    `);

    if (textResult.rows.length === 0) {
      throw new Error('No text content found for paper');
    }

    // Combine all pages into full text
    let fullText = '';
    const pageBreaks: number[] = [];

    for (const row of textResult.rows) {
      pageBreaks.push(fullText.length);
      fullText += (row.text_content as string) + '\n\n';
    }

    // Chunk the text
    const chunks = this.chunkText(fullText, pageBreaks);

    if (chunks.length === 0) {
      throw new Error('No valid chunks generated');
    }

    // Update paper status
    await db.execute(sql`
      UPDATE papers
      SET chunking_status = 'processing'
      WHERE id = ${paperId}
    `);

    try {
      // Generate embeddings in batches
      const batchSize = 20;
      let insertedCount = 0;

      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        const texts = batch.map(c => c.text);

        // Call OpenAI embeddings API
        const response = await this.openai.embeddings.create({
          model: EMBEDDING_MODEL,
          input: texts,
        });

        // Insert chunks with embeddings
        for (let j = 0; j < batch.length; j++) {
          const chunk = batch[j];
          const embedding = response.data[j].embedding;

          await db.execute(sql`
            INSERT INTO paper_chunks (
              paper_id, chunk_index, page_number, text_content,
              char_start, char_end, token_count, embedding
            ) VALUES (
              ${paperId}, ${i + j}, ${chunk.pageNumber || null}, ${chunk.text},
              ${chunk.charStart}, ${chunk.charEnd}, ${chunk.tokenCount || 0},
              ${JSON.stringify(embedding)}::vector
            )
            ON CONFLICT (paper_id, chunk_index) DO UPDATE SET
              text_content = EXCLUDED.text_content,
              embedding = EXCLUDED.embedding
          `);
          insertedCount++;
        }
      }

      // Update paper status
      await db.execute(sql`
        UPDATE papers
        SET
          chunking_status = 'ready',
          chunks_count = ${insertedCount},
          last_chunked_at = NOW()
        WHERE id = ${paperId}
      `);

      return insertedCount;

    } catch (error) {
      // Update paper status on error
      await db.execute(sql`
        UPDATE papers
        SET chunking_status = 'error'
        WHERE id = ${paperId}
      `);
      throw error;
    }
  }

  // ===========================================================================
  // Semantic Search
  // ===========================================================================

  /**
   * Find relevant chunks using vector similarity
   */
  async findRelevantChunks(
    paperId: string,
    query: string,
    limit: number = MAX_CONTEXT_CHUNKS
  ): Promise<RetrievedChunk[]> {
    if (!this.openai) {
      throw new Error('OpenAI API key not configured');
    }

    // Generate query embedding
    const response = await this.openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: query,
    });

    const queryEmbedding = response.data[0].embedding;

    // Search for similar chunks using pgvector
    const result = await db.execute(sql`
      SELECT
        id,
        chunk_index,
        page_number,
        text_content,
        (1 - (embedding <=> ${JSON.stringify(queryEmbedding)}::vector)) as similarity
      FROM paper_chunks
      WHERE paper_id = ${paperId}
        AND embedding IS NOT NULL
      ORDER BY embedding <=> ${JSON.stringify(queryEmbedding)}::vector
      LIMIT ${limit}
    `);

    return result.rows.map(row => ({
      id: row.id as string,
      chunkIndex: row.chunk_index as number,
      pageNumber: row.page_number as number | null,
      textContent: row.text_content as string,
      similarity: parseFloat(row.similarity as string),
    })).filter(c => c.similarity >= MIN_SIMILARITY);
  }

  // ===========================================================================
  // Chat Completion
  // ===========================================================================

  /**
   * Process a chat message with RAG context
   */
  async chat(
    paperId: string,
    userId: string,
    userMessage: string,
    conversationHistory?: ChatMessage[]
  ): Promise<ChatResponse> {
    if (!this.openai) {
      throw new Error('OpenAI API key not configured');
    }

    const startTime = Date.now();

    // Get paper info
    const paperResult = await db.execute(sql`
      SELECT title, authors, abstract, year, journal
      FROM papers WHERE id = ${paperId}
    `);

    if (paperResult.rows.length === 0) {
      throw new Error('Paper not found');
    }

    const paper = paperResult.rows[0];

    // Find relevant chunks
    const contextChunks = await this.findRelevantChunks(paperId, userMessage);

    // Build context string
    const contextText = contextChunks.length > 0
      ? contextChunks.map((c, i) => `[Page ${c.pageNumber || '?'}] ${c.textContent}`).join('\n\n---\n\n')
      : 'No relevant context found in the paper.';

    // Build messages array
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: `You are a research assistant helping analyze a scientific paper.

Paper: "${paper.title}"
Authors: ${JSON.stringify(paper.authors) || 'Unknown'}
Year: ${paper.year || 'Unknown'}
Journal: ${paper.journal || 'Unknown'}

When answering questions:
1. Base your answers on the provided context from the paper
2. Cite specific page numbers when referencing information
3. Be clear when something is not mentioned in the paper
4. Provide accurate, helpful responses for researchers

Context from the paper:
${contextText}`,
      },
    ];

    // Add conversation history
    if (conversationHistory && conversationHistory.length > 0) {
      for (const msg of conversationHistory.slice(-10)) { // last 10 messages
        messages.push({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        });
      }
    }

    // Add current user message
    messages.push({ role: 'user', content: userMessage });

    // Call OpenAI chat completion
    const completion = await this.openai.chat.completions.create({
      model: CHAT_MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 1500,
    });

    const assistantMessage = completion.choices[0]?.message?.content || 'No response generated';
    const latencyMs = Date.now() - startTime;

    // Store messages in database
    await db.execute(sql`
      INSERT INTO paper_chat_messages (
        paper_id, user_id, role, content, context_chunk_ids,
        model_used, tokens_input, tokens_output, latency_ms
      ) VALUES (
        ${paperId}, ${userId}, 'user', ${userMessage},
        ${[] as string[]}, ${CHAT_MODEL}, 0, 0, 0
      )
    `);

    await db.execute(sql`
      INSERT INTO paper_chat_messages (
        paper_id, user_id, role, content, context_chunk_ids,
        model_used, tokens_input, tokens_output, latency_ms
      ) VALUES (
        ${paperId}, ${userId}, 'assistant', ${assistantMessage},
        ${contextChunks.map(c => c.id)},
        ${CHAT_MODEL},
        ${completion.usage?.prompt_tokens || 0},
        ${completion.usage?.completion_tokens || 0},
        ${latencyMs}
      )
    `);

    return {
      message: assistantMessage,
      contextChunks,
      model: CHAT_MODEL,
      tokensInput: completion.usage?.prompt_tokens || 0,
      tokensOutput: completion.usage?.completion_tokens || 0,
      latencyMs,
    };
  }

  /**
   * Get chat history for a paper
   */
  async getChatHistory(paperId: string, userId: string, limit: number = 50): Promise<any[]> {
    const result = await db.execute(sql`
      SELECT id, role, content, context_chunk_ids, model_used,
             tokens_input, tokens_output, latency_ms, created_at
      FROM paper_chat_messages
      WHERE paper_id = ${paperId} AND user_id = ${userId}
      ORDER BY created_at ASC
      LIMIT ${limit}
    `);

    return result.rows;
  }

  // ===========================================================================
  // Summary Generation
  // ===========================================================================

  /**
   * Generate a summary of the paper
   */
  async generateSummary(
    paperId: string,
    userId: string,
    summaryType: 'abstract' | 'full' | 'methods' | 'results' | 'key_findings' = 'full'
  ): Promise<SummaryResponse> {
    if (!this.openai) {
      throw new Error('OpenAI API key not configured');
    }

    // Check for cached summary
    const cached = await db.execute(sql`
      SELECT content, model_used
      FROM paper_summaries
      WHERE paper_id = ${paperId}
        AND user_id = ${userId}
        AND summary_type = ${summaryType}
        AND is_stale = FALSE
    `);

    if (cached.rows.length > 0) {
      return {
        summary: cached.rows[0].content as string,
        type: summaryType,
        model: cached.rows[0].model_used as string,
      };
    }

    // Get paper text
    const textResult = await db.execute(sql`
      SELECT text_content
      FROM paper_text_content
      WHERE paper_id = ${paperId}
      ORDER BY page_number
    `);

    const fullText = textResult.rows.map(r => r.text_content).join('\n\n');

    // Build prompt based on summary type
    const prompts: Record<string, string> = {
      abstract: 'Write a concise abstract (150-250 words) summarizing this paper\'s key contributions.',
      full: 'Provide a comprehensive summary of this paper, covering: background, methods, results, and conclusions.',
      methods: 'Summarize the methodology used in this paper, including study design, data collection, and analysis.',
      results: 'Summarize the main results and findings of this paper.',
      key_findings: 'List the 5-7 most important findings or takeaways from this paper.',
    };

    const completion = await this.openai.chat.completions.create({
      model: CHAT_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are a research assistant skilled at summarizing scientific papers accurately and concisely.',
        },
        {
          role: 'user',
          content: `${prompts[summaryType]}\n\nPaper content:\n${fullText.slice(0, 15000)}`, // Limit input
        },
      ],
      temperature: 0.5,
      max_tokens: 1000,
    });

    const summary = completion.choices[0]?.message?.content || '';

    // Cache the summary
    await db.execute(sql`
      INSERT INTO paper_summaries (
        paper_id, user_id, summary_type, content, model_used, prompt_version
      ) VALUES (
        ${paperId}, ${userId}, ${summaryType}, ${summary}, ${CHAT_MODEL}, 'v1'
      )
      ON CONFLICT (paper_id, user_id, summary_type) DO UPDATE SET
        content = EXCLUDED.content,
        is_stale = FALSE,
        updated_at = NOW()
    `);

    return { summary, type: summaryType, model: CHAT_MODEL };
  }

  // ===========================================================================
  // Claim Extraction
  // ===========================================================================

  /**
   * Extract key claims from the paper
   */
  async extractClaims(paperId: string, userId: string): Promise<ClaimResponse> {
    if (!this.openai) {
      throw new Error('OpenAI API key not configured');
    }

    // Get paper text
    const textResult = await db.execute(sql`
      SELECT page_number, text_content
      FROM paper_text_content
      WHERE paper_id = ${paperId}
      ORDER BY page_number
    `);

    const fullText = textResult.rows.map(r => r.text_content).join('\n\n');

    const completion = await this.openai.chat.completions.create({
      model: CHAT_MODEL,
      messages: [
        {
          role: 'system',
          content: `You are a research assistant skilled at extracting key claims from scientific papers.

Extract the main claims, findings, and conclusions from the paper. For each claim, provide:
- The claim text
- The type (finding, method, limitation, or conclusion)
- Your confidence level (0.0 to 1.0)

Format your response as a JSON array:
[{"text": "...", "type": "finding", "confidence": 0.9}, ...]`,
        },
        {
          role: 'user',
          content: `Extract key claims from this paper:\n\n${fullText.slice(0, 15000)}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    let claims: any[] = [];
    try {
      const content = completion.choices[0]?.message?.content || '{"claims":[]}';
      const parsed = JSON.parse(content);
      claims = parsed.claims || parsed;
    } catch (e) {
      console.error('[PaperCopilot] Failed to parse claims:', e);
    }

    // Store claims in database
    for (const claim of claims) {
      await db.execute(sql`
        INSERT INTO paper_claims (
          paper_id, user_id, claim_text, claim_type, confidence_score
        ) VALUES (
          ${paperId}, ${userId}, ${claim.text}, ${claim.type}, ${claim.confidence}
        )
      `);
    }

    return { claims, model: CHAT_MODEL };
  }
}

export const paperCopilotService = new PaperCopilotService();
