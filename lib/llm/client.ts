type JsonObject = Record<string, unknown>;

type Provider = 'openai' | 'anthropic';

function getProvider(): Provider {
  const raw = (process.env.LLM_PROVIDER ?? 'openai').toLowerCase();
  if (raw !== 'openai' && raw !== 'anthropic') {
    throw new Error(`Unsupported LLM_PROVIDER '${raw}'. Use 'openai' or 'anthropic'.`);
  }
  return raw;
}

function parseJsonPayload(raw: string): JsonObject {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');

  try {
    const parsed: unknown = JSON.parse(cleaned);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('LLM response is not a JSON object.');
    }
    return parsed as JsonObject;
  } catch (error) {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      const candidate = cleaned.slice(start, end + 1);
      const parsed: unknown = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as JsonObject;
      }
    }
    throw new Error(`Could not parse LLM JSON response: ${error instanceof Error ? error.message : 'unknown error'}`);
  }
}

async function callOpenAI(systemPrompt: string, userText: string): Promise<JsonObject> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured.');
  }

  const baseUrl = (process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/$/, '');
  const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userText },
      ],
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI request failed (${response.status}): ${body.slice(0, 500)}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('OpenAI returned an empty response.');
  }

  return parseJsonPayload(content);
}

async function callAnthropic(systemPrompt: string, userText: string): Promise<JsonObject> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured.');
  }

  const baseUrl = (process.env.ANTHROPIC_BASE_URL ?? 'https://api.anthropic.com').replace(/\/$/, '');
  const model = process.env.ANTHROPIC_MODEL ?? 'claude-3-5-haiku-latest';

  const response = await fetch(`${baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      temperature: 0.2,
      system: `${systemPrompt}\nReturn a valid JSON object only.`,
      messages: [{ role: 'user', content: userText }],
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Anthropic request failed (${response.status}): ${body.slice(0, 500)}`);
  }

  const data = (await response.json()) as {
    content?: Array<{ type?: string; text?: string }>;
  };
  const content = data.content?.find((item) => item.type === 'text')?.text;
  if (!content) {
    throw new Error('Anthropic returned an empty response.');
  }

  return parseJsonPayload(content);
}

export async function executeLLMPrompt<T extends JsonObject = JsonObject>(
  systemPrompt: string,
  userText: string,
): Promise<T> {
  const provider = getProvider();
  const result =
    provider === 'anthropic'
      ? await callAnthropic(systemPrompt, userText)
      : await callOpenAI(systemPrompt, userText);

  return result as T;
}
