import Anthropic from '@anthropic-ai/sdk';
import { NextRequest } from 'next/server';
import { FLOW_NODES } from '@/data/ragData';

const client = new Anthropic();

interface LLMRequest {
  userMessage: string;
  history: { role: 'user' | 'assistant'; content: string }[];
  currentNode: string;
  zodiacSign?: string;
  category?: string;
}

export async function POST(req: NextRequest) {
  const body: LLMRequest = await req.json();
  const { userMessage, history, currentNode, zodiacSign, category } = body;

  const node = FLOW_NODES.find((n) => n.id === currentNode);
  const nodeInstruction = node?.systemInstruction ?? '';

  const systemLines = [
    'あなたは西洋占星術の神秘的な占い師「星詠み」です。温かく、詩的な口調で話してください。',
  ];
  if (zodiacSign) systemLines.push(`ユーザーの星座: ${zodiacSign}`);
  if (category) systemLines.push(`現在の相談カテゴリ: ${category}`);
  if (nodeInstruction) systemLines.push('', nodeInstruction);
  systemLines.push('', '回答は自然な会話として200文字程度を目安にしてください。');

  const messages = [
    ...history.map((h) => ({
      role: h.role as 'user' | 'assistant',
      content: h.content,
    })),
    { role: 'user' as const, content: userMessage },
  ];

  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      try {
        const stream = client.messages.stream({
          model: 'claude-opus-4-7',
          max_tokens: 1024,
          thinking: { type: 'adaptive' },
          system: systemLines.join('\n'),
          messages,
        });

        for await (const event of stream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ token: event.delta.text })}\n\n`
              )
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
