import OpenAI from 'openai';
import { NextRequest } from 'next/server';
import { buildSystemPrompt } from '@/lib/rag/promptBuilder';
import { retrieveContext } from '@/lib/rag/retriever';
import type { ConversationState } from '@/lib/rag/conversationFlow';
import type { FlowState } from '@/data/ragData';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';

const openai = new OpenAI();

const VALID_NODES = new Set<string>([
  'greeting', 'category_detection', 'love', 'work', 'health',
  'money', 'relationship', 'fortune_reading', 'advice', 'followup', 'closing',
]);
const VALID_CATEGORIES = new Set<string>(['love', 'work', 'health', 'money', 'relationship']);

const MAX_USER_MSG = 1000;
const MAX_HISTORY = 20;
const MAX_CONTENT = 2000;
const FETCH_TIMEOUT_MS = 30_000;
// gpt-4o は高価なので1分あたり10件に制限
const RATE_LIMIT = { limit: 10, windowMs: 60_000 };

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const { allowed } = checkRateLimit(`llm:${ip}`, RATE_LIMIT.limit, RATE_LIMIT.windowMs);
  if (!allowed) {
    const encoder = new TextEncoder();
    return new Response(
      encoder.encode(`data: ${JSON.stringify({ error: 'リクエストが多すぎます。しばらく待ってください' })}\n\ndata: [DONE]\n\n`),
      { status: 429, headers: { 'Content-Type': 'text/event-stream' } }
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return new Response(null, { status: 400 });
  }
  if (typeof rawBody !== 'object' || rawBody === null) {
    return new Response(null, { status: 400 });
  }

  const b = rawBody as Record<string, unknown>;

  // userMessage
  if (typeof b.userMessage !== 'string' || b.userMessage.trim() === '') {
    return new Response(null, { status: 400 });
  }
  if (b.userMessage.length > MAX_USER_MSG) {
    return new Response(null, { status: 400 });
  }
  const userMessage = b.userMessage.trim();

  // history
  if (!Array.isArray(b.history) || b.history.length > MAX_HISTORY) {
    return new Response(null, { status: 400 });
  }
  const history: { role: 'user' | 'assistant'; content: string }[] = [];
  for (const item of b.history) {
    if (typeof item !== 'object' || item === null) continue;
    const h = item as Record<string, unknown>;
    if (h.role !== 'user' && h.role !== 'assistant') continue;
    if (typeof h.content !== 'string') continue;
    history.push({ role: h.role, content: h.content.slice(0, MAX_CONTENT) });
  }

  // currentNode
  if (typeof b.currentNode !== 'string' || !VALID_NODES.has(b.currentNode)) {
    return new Response(null, { status: 400 });
  }
  const currentNode = b.currentNode as FlowState;

  // optional fields
  const zodiacSign =
    typeof b.zodiacSign === 'string' ? b.zodiacSign.slice(0, 20) : undefined;
  const category =
    typeof b.category === 'string' && VALID_CATEGORIES.has(b.category)
      ? b.category
      : undefined;

  const state: ConversationState = {
    currentNode,
    zodiacSign,
    category,
    history,
    turnCount: history.length,
  };

  const encoder = new TextEncoder();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  const readable = new ReadableStream({
    async start(ctrl) {
      try {
        const ragResults = await retrieveContext(userMessage, state);
        const systemPrompt = buildSystemPrompt(state, ragResults);

        // history 末尾に今回のユーザー発言が含まれているためそのまま使う（重複なし）
        const messages = history
          .slice(-12)
          .map((h) => ({ role: h.role as 'user' | 'assistant', content: h.content }));

        const stream = await openai.chat.completions.create(
          {
            model: 'gpt-4o',
            max_tokens: 1024,
            messages: [{ role: 'system', content: systemPrompt }, ...messages],
            stream: true,
          },
          { signal: controller.signal }
        );

        for await (const chunk of stream) {
          const token = chunk.choices[0]?.delta?.content;
          if (token) {
            ctrl.enqueue(
              encoder.encode(`data: ${JSON.stringify({ token })}\n\n`)
            );
          }
        }

        ctrl.enqueue(encoder.encode('data: [DONE]\n\n'));
        ctrl.close();
      } catch (err) {
        const isAbort = err instanceof Error && err.name === 'AbortError';
        const msg = isAbort ? '応答がタイムアウトしました' : '応答生成に失敗しました';
        ctrl.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
        ctrl.close();
      } finally {
        clearTimeout(timer);
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
