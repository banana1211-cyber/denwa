import OpenAI from 'openai';
import { NextRequest } from 'next/server';
import { buildSystemPrompt } from '@/lib/rag/promptBuilder';
import { retrieveContext } from '@/lib/rag/retriever';
import type { ConversationState } from '@/lib/rag/conversationFlow';
import type { FlowState } from '@/data/ragData';

const openai = new OpenAI();

interface LLMRequest {
  userMessage: string;
  // history は transition() 済み（末尾に今回のユーザー発言が含まれている）
  history: { role: 'user' | 'assistant'; content: string }[];
  currentNode: string;
  zodiacSign?: string;
  category?: string;
}

export async function POST(req: NextRequest) {
  const body: LLMRequest = await req.json();
  const { userMessage, history, currentNode, zodiacSign, category } = body;

  // ConversationState を復元（RAG内部で使用）
  const state: ConversationState = {
    currentNode: currentNode as FlowState,
    zodiacSign,
    category,
    history,
    turnCount: history.length,
  };

  // RAGコンテキスト取得 + システムプロンプト構築
  const ragResults = await retrieveContext(userMessage, state);
  const systemPrompt = buildSystemPrompt(state, ragResults);

  // history は末尾に今回のユーザー発言を含む（transition() で追加済み）
  // → そのまま messages に渡す（重複防止）
  const messages = history
    .slice(-12)
    .map((h) => ({ role: h.role as 'user' | 'assistant', content: h.content }));

  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      try {
        const stream = await openai.chat.completions.create({
          model: 'gpt-4o',
          max_tokens: 1024,
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages,
          ],
          stream: true,
        });

        for await (const chunk of stream) {
          const token = chunk.choices[0]?.delta?.content;
          if (token) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ token })}\n\n`)
            );
          }
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`)
        );
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
