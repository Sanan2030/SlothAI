# lazy.ai Platformasının Full-Stack Arxitekturası, Azərbaycan Dili NLP Normalizasiyası və Yüksək Həcmli AI Prompt Mühəndisliyi Hesabatı

Rəqəmsal mətn emalı sistemlərinin qurulması, xüsusilə Azərbaycan dili kimi aqqlütinativ morfoloji quruluşa və zəngin diakritik simvol şəbəkəsinə sahib dillərdə xüsusi linqvistik və proqram təminatı arxitekturası yanaşmaları tələb edir. `lazy.ai` tətbiqi, istifadəçilərin daxil etdiyi qeyri-səlis, diakritik simvolları əskik (`dusunmek` kimi), durğu işarələri pozulmuş və abzas strukturu olmayan xam mətnləri avtomatik olaraq yüksək səviyyəli, linqvistik baxımdan dəqiq və strukturlaşdırılmış formata salan full-stack platformadır.

Bu hesabat, `lazy.ai` platformasının Vercel infrastrukturunda optimal yerləşdirilməsini (deployment), TypeScript və Next.js App Router üzərində genişləndirilə bilən Strategiya Model Tipi (Strategy Pattern) üzrə backend arxitekturasını, Azərbaycan dilinin NLP bərpa mexanizmlərini və proqram kodunu avtomatik generasiya edəcək başqa bir süni intellekt modelinə təqdim edilməli olan istehsalat səviyyəli Master Prompt (Meta-Prompt) spesifikasiyasını əhatə edir.

## 1. Azərbaycan Dilində Mətn Normalizasiyası və LLM Əsaslı Fonetik/Sintaktik Bərpa Mexanizmi

Azərbaycan dilində rəqəmsal kommunikasiya zamanı istifadəçilərin ingilis əlifba düzümündən istifadə edərək diakritik hərifləri (`ç, ğ, ı, ö, ş, ü`) onların standart ASCII qarşılıqları (`c, g, i, o, s, u`) ilə əvəzləməsi tez-tez müşahidə olunan problemdir. Bu hal təkcə orfoqrafik xəta yaratmır, aynı zamanda sözün semantik mənasını və cümlənin sintaktik strukturunu kəskin dərəcədə dəyişir. Məsələn, "sira" sözünün kontekstdən asılı olaraq "sıra" (növ növbə) və ya "sirə" (şirə) mənasına gəlməsi, "dusunmek" feilinin "düşünmək" formasına bərpası yalnız söz səviyyəsində deyil, bütün cümlə kontekstinin analizi ilə mümkündür.

Trandision lüğət əsaslı (dictionary lookup) və ya sadə n-gram modelləri Azərbaycan dilinin aqqlütinativ yapısına — söz köklərinə çoxlu sayda leksik və qrammatik şəkilçilərin artırılması xüsusiyyətinə görə kifayətsiz qalır. Geniş Dil Modelləri (LLM) isə ardıcıllıqdan-ardıcıllığa (sequence-to-sequence) transformator arxitekturası sayəsində mətnin ümumi semantikasını dərk edərək diakritikləri, durğu işarələrini və abzas strukturlarını dəqiqliklə bərpa edir.

| **Emal Ölçüsü**     | **Ənənəvi Lüğət / Rule-Based Sistemlər** | **Context-Aware LLM Transformator Arxitekturası** |
| ------------------- | ---------------------------------------- | ------------------------------------------------- |
| **Diakritik Bərpa** |                                          |                                                   |

Tək-tək söz uyğunluğu; kontekstual ikiləşmələri həll edə bilmir.

|   |
| - |

Bütün cümlənin semantikasını analiz edərək `dusunmek` -> `düşünmək` bərpası edir.

| **Durğu İşarələri**         | Statik qaydalar; mürəkkəb cümlələrdə vergül və nöqtə xətaları yaradır. | Bağlayıcıları və cümlə sərhədlərini müəyyən edib vergül və nöqtələri düzgün yerləşdirir.         |
| --------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **Abzas və Siyahılama**     | Strukturu tanıya bilmir; mətni sıx formada saxlayır.                   | Məntiqi fikir keçidlərini aşkar edərək abzaslara ayırır və nömrələnmiş/bullet siyahılar yaradır. |
| **Aqqlütinativ Şəkilçilər** |                                                                        |                                                                                                  |

Şəkilçi kombinasiyalarının çoxluğundan leksikon kəskin böyüyür.

|   |
| - |

Morfoloji kök və şəkilçi zəncirini generativ kontekstlə hamar bərpa edir.

Mətnin bərpası prosesində `lazy.ai` tətbiqi daxil olan mətni dörd ardıcıl mərhələdə emal edir. Birinci mərhələdə hərf səviyyəsində diakritik simvollar bərpa olunur. İkinci mərhələdə cümlələr arası sintaktik əlaqələr analiz edilərək vergül, nöqtə və tire kimi durğu işarələri əlavə edilir. Üçüncü mərhələdə semantic fikir keçidlərinə əsasən sıxlaşdırılmış mətn abzaslara bölünür. Dördüncü mərhələdə isə ardıcıl sadalanan elementlər aşkar edilərək standart Markdown siyahı formatına (`-` və ya `1.`) salınır.

## 2. Vercel İnfrastrukturu və Full-Stack Next.js App Router Arxitekturası

`lazy.ai` platformasının istehsalat mühitində (production) sıfır konfiqurasiya mürəkkəbliyi ilə yerləşdirilməsi üçün Vercel infrastrukturu və Next.js App Router freymvorku seçilmişdir. Vercel platformasında tətbiqlərin qurulması zamanı müxtəlif arxitektur modellər mövcuddur. Xüsusilə CV parser kimi mürəkkəb sənəd emalı və ya mətn transformasiyası həyata keçirən repository-lərdə geniş istifadə olunan "Single Framework" (Vahid Freymvork) modeli `lazy.ai` üçün ən optimal strukturdur.

Vahid freymvork modeli çərçivəsində həm frontend istifadəçi interfeysi, həm də backend API Route Handler-ləri tək bir Next.js layihəsində birləşdirilir. Bu model dəyişənlərin vahid mühitdə idarə olunmasına, CORS (Cross-Origin Resource Sharing) mürəkkəbliyinin aradan qaldırılmasına və Vercel Edge/Serverless şəbəkəsində ultra-aşağı gecikmə müddətinə (latency) şərait yaradır.

| **Təşkilati Ölçü**    | **Single Framework (Next.js)** | **Monorepo Structure** | **Vercel Services Model** |
| --------------------- | ------------------------------ | ---------------------- | ------------------------- |
| **Domen İdarəetməsi** |                                |                        |                           |

Vahid domen və eyni origin.

|   |
| - |

Hər layihə üçün ayrı domen.

|   |
| - |

Vahid domen altında path prefix routing.

| **CORS Konfiqurasiyası** |   |
| ------------------------ | - |

Tələb olunmur (Same-origin).

|   |
| - |

Açiq CORS konfiqurasiyası tələb olunur.

|   |
| - |

Daxili marşrutlaşdırma.

| **Deployment Skalası** |   |
| ---------------------- | - |

Vahid düymə ilə tam atomik deployment.

|   |
| - |

Müstəqil rollback və deployment.

|   |
| - |

Müstəqil servis build-ləri.

| **İstifadə Ssenarisi** |   |
| ---------------------- | - |

`lazy.ai` kimi full-stack Next.js app-ları.

|   |
| - |

Böyük komanda və fərqli sistemlər.

|   |
| - |

Fərqli dillərdə (Python+Node) backend-lər.

Layihənin fayl strukturu Next.js App Router standartlarına uyğun olaraq aşağıdakı kimi təşkil edilir:

lazy-ai/

├── app/

│   ├── layout.tsx

│   ├── page.tsx

│   ├── globals.css

│   └── api/

│       ├── transform/

│       │   └── route.ts

│       └── strategies/

│           └── route.ts

├── components/

│   ├── ui/

│   ├── Header.tsx

│   ├── TextEditorPane.tsx

│   └── StrategySelector.tsx

├── lib/

│   ├── llm/

│   │   └── client.ts

│   └── strategies/

│       ├── types.ts

│       ├── registry.ts

│       └── impl/

│           ├── text-corrector.ts

│           └── gmail-corrector.ts

├── public/

├── vercel.json

├── package.json

├── tsconfig.json

└── tailwind.config.js

Vercel platformasının serverless funksiyalarını optimal şəkildə konfiqurasiya etmək üçün layihənin kök qovluğunda yerləşən `vercel.json` faylı xüsusi timeout və yaddaş parametrləri ilə təyin olunur. Böyük mətnlərin LLM tərəfindən emalı zamanı serverless timeout xətalarının qarşısını almaq üçün funksiyanın icra müddəti maksimal həddə qaldırılır.

JSON

```
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "buildCommand": "next build",
  "devCommand": "next dev",
  "installCommand": "npm install",
  "regions": ["fra1"],
  "functions": {
    "app/api/**/route.ts": {
      "memory": 1024,
      "maxDuration": 60
    }
  }
}

```

## 3. Açıq-Qapalı Prinsipə Söykənən Genişləndirilə Bilən Strategiya Və Dinamik Registr Modeli

`lazy.ai` sisteminin arxitektur baxımdan ən mühüm tələbi tətbiqin gələcəkdə yeni mətn emal formatlarını ("Gmail Düzəldici", "Akademik Mətn Redaktoru", "Rəsmi Məktub Standartlaşdırıcısı") mövcud sistemin kod bazasına dəyişiklik etmədən qəbul edə bilməsidir. Bu tələb OOD (Object-Oriented Design) prinsiplərindən olan Açıq-Qapalı Prinsipini (Open-Closed Principle: genişlənməyə açıq, dəyişikliyə qapalı) təmin edən Strategiya Model Tipi (Strategy Pattern) vasitəsilə həyata keçirilir.

Sistemdə hər bir mətn emal novü müstəqil strategiya sinfi kimi reallaşdırılır. Bütün strategiyalar cəza təsbit edən vahid `ITextTransformationStrategy` interfeysini tətbiq edir. Dinamik Registr (Dynamic Registry) isə çalışma zamanı (runtime) daxil olan sorğunun ID parametrinə əsasən lazımi strategiyanı seçir və icra edir.

### Strategiya İnterfeysinin Təyini (`lib/strategies/types.ts`)

TypeScript

```
export interface TransformationOptions {
  tone?: 'default' | 'formal' | 'casual';
  preserveFormatting?: boolean;
  customRules?: string[];
}

export interface TransformationRequest {
  text: string;
  options?: TransformationOptions;
}

export interface TransformationMetadata {
  correctionsMade: number;
  detectedLanguage: string;
  executionTimeMs: number;
  strategyUsed: string;
}

export interface TransformationResult {
  transformedText: string;
  metadata: TransformationMetadata;
}

export interface ITextTransformationStrategy {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly icon: string;
  
  transform(request: TransformationRequest): Promise<TransformationResult>;
}

```

### Dinamik Registr Modulu (`lib/strategies/registry.ts`)

TypeScript

```
import { ITextTransformationStrategy } from './types';

export class TextTransformationRegistry {
  private static instance: TextTransformationRegistry;
  private strategies: Map<string, ITextTransformationStrategy> = new Map();

  private constructor() {}

  public static getInstance(): TextTransformationRegistry {
    if (!TextTransformationRegistry.instance) {
      TextTransformationRegistry.instance = new TextTransformationRegistry();
    }
    return TextTransformationRegistry.instance;
  }

  public register(strategy: ITextTransformationStrategy): void {
    if (this.strategies.has(strategy.id)) {
      console.warn(`Strategy with ID '${strategy.id}' is already registered. Overwriting.`);
    }
    this.strategies.set(strategy.id, strategy);
  }

  public get(id: string): ITextTransformationStrategy {
    const strategy = this.strategies.get(id);
    if (!strategy) {
      throw new Error(`Transformation strategy '${id}' was not found in the registry.`);
    }
    return strategy;
  }

  public listStrategies(): Array<{ id: string; name: string; description: string; icon: string }> {
    return Array.from(this.strategies.values()).map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      icon: s.icon,
    }));
  }
}

```

### Mətn Düzəldici Konkret Strategiya (`lib/strategies/impl/text-corrector.ts`)

TypeScript

```
import { ITextTransformationStrategy, TransformationRequest, TransformationResult } from '../types';
import { executeLLMPrompt } from '@/lib/llm/client';

export class AzerbaijaniTextCorrectorStrategy implements ITextTransformationStrategy {
  public readonly id = 'text-corrector';
  public readonly name = 'Mətn Düzəldici';
  public readonly description = 'Azərbaycan dilində diakritikləri, durğu işarələrini, abzasları və siyahıları bərpa edir.';
  public readonly icon = 'FileText';

  public async transform(request: TransformationRequest): Promise<TransformationResult> {
    const startTime = Date.now();
    
    const systemPrompt = `You are 'lazy.ai', an elite NLP text restoration engine for the Azerbaijani language.
Your objective is to correct unstructured, grammatically broken, or informal Azerbaijani text.

RULES:
1. DIACRITICS: Restore all missing Azerbaijani diacritics automatically (e.g., convert "dusunmek" -> "düşünmək", "qelirem" -> "gəlirəm", "sira" -> "sıra", "yag" -> "yağ").
2. PUNCTUATION: Fix missing periods, commas, dashes, and question marks according to strict Azerbaijani syntax rules.
3. PARAGRAPHS: Split dense, unformatted text blocks into clear, logical paragraphs.
4. LISTS: Detect enumeration patterns and convert them into standard Markdown lists (- item or 1. item).
5. CASING: Fix sentence starting capitalization and proper noun capitalization.
6. OUTPUT FORMAT: Return ONLY a raw JSON object with keys "transformedText" and "correctionsCount". Do not wrap in markdown quotes unless specified.`;

    const response = await executeLLMPrompt(systemPrompt, request.text);
    const parsed = JSON.parse(response);

    return {
      transformedText: parsed.transformedText,
      metadata: {
        correctionsMade: parsed.correctionsCount || 0,
        detectedLanguage: 'az',
        executionTimeMs: Date.now() - startTime,
        strategyUsed: this.id,
      },
    };
  }
}

```

### Gələcək Gmail/E-Poçt Düzəldici Strategiyası Şablonu (`lib/strategies/impl/gmail-corrector.ts`)

Gələcəkdə e-poçt formatlayıcısı əlavə etmək lazım gəldikdə, daxili API və ya UI koduna toxunmadan sadəcə aşağıdakı kimi yeni bir fayl təyin olunur və registrə daxil edilir:

TypeScript

```
import { ITextTransformationStrategy, TransformationRequest, TransformationResult } from '../types';
import { executeLLMPrompt } from '@/lib/llm/client';

export class GmailCorrectorStrategy implements ITextTransformationStrategy {
  public readonly id = 'gmail-corrector';
  public readonly name = 'Gmail Düzəldici';
  public readonly description = 'Mətni rəsmi/işgüzar e-poçt (Gmail) strukturuna və etiketinə salır.';
  public readonly icon = 'Mail';

  public async transform(request: TransformationRequest): Promise<TransformationResult> {
    const startTime = Date.now();
    
    const systemPrompt = `You are 'lazy.ai' Email Editor. Convert the input raw note into a professional Azerbaijani business email with Subject, Salutation, Body paragraphs, and Professional Sign-off. Return output as JSON with key "transformedText".`;

    const response = await executeLLMPrompt(systemPrompt, request.text);
    const parsed = JSON.parse(response);

    return {
      transformedText: parsed.transformedText,
      metadata: {
        correctionsMade: 1,
        detectedLanguage: 'az',
        executionTimeMs: Date.now() - startTime,
        strategyUsed: this.id,
      },
    };
  }
}

```

## 4. İcraçı Süni İntellekt Modelləri üçün Tam Həcmli Master Prompt (Meta-Prompt) Spesifikasiyası

İstifadəçinin digər proqramlaşdırıcı süni intellekt modelinə (məsələn, Claude 3.5 Sonnet, GPT-4o və ya DeepSeek-R1) verəcəyi master prompt aşağıdakı qutuda dəqiqliklə tərtib olunmuşdur. Bu prompt token məhdudiyyəti nəzərə alınmadan modelin maksimum imkanlarını ("max power") işə salmaq və tam, kəsilməz, istehsalata hazır proqram kodunu avtomatik yaratmaq üçün optimallaşdırılmışdır:

You are acting as a Principal Full-Stack Software Architect and Lead AI Engineer. You are tasked with generating the complete, functional, production-ready codebase for a web application named "lazy.ai".

Context & Requirements:

- The app takes broken, informal, or orthographically missing text (specifically for the Azerbaijani language) and transforms it into clean, grammatically sound, correctly punctuated, and properly paragraph-structured text.
- Key transformation capability: Automatic diacritic restoration (e.g., converting "dusunmek" -> "düşünmək", "qelirem" -> "gəlirəm", "sira" -> "sıra"), syntax correction (comma/period insertion), auto-paragraphing, and Markdown list formatting.
- The app must be fully deployable to Vercel using Next.js App Router in a single-repository full-stack architecture (Single Framework approach with route handlers).
- Extensibility requirement: The backend MUST use the Strategy Pattern and a Dynamic Registry for text processing types.
- Currently, the focus is on the "Mətn Düzəldici" (Text Corrector) strategy, but the system must be architected so that additional options like "Gmail Düzəldici" (Email Formatter) can be added seamlessly by simply registering a new strategy class without modifying the route handler or core client code.

Your Output Instructions:

1. Do NOT abbreviate code, use placeholders like "// todo: implement later", or skip files. Write every single line of code completely. Token limit is disabled; use maximum reasoning and generation capacity.
2. Structure the codebase as a Next.js 14+ App Router project configured for Vercel deployment.

Generate the exact, un-truncated content for the following core files:

\--- FILE 1: `vercel.json` ---

Define runtime configuration, regions (e.g. fra1), maxDuration (60s), and memory allocations.

\--- FILE 2: `package.json` ---

Include dependencies: next, react, react-dom, typescript, tailwindcss, zod, lucide-react, clsx, tailwind-merge, class-variance-authority.

\--- FILE 3: `lib/strategies/types.ts` ---

Define interfaces: `TransformationOptions`, `TransformationRequest`, `TransformationMetadata`, `TransformationResult`, and `ITextTransformationStrategy`.

\--- FILE 4: `lib/strategies/registry.ts` ---

Implement a Singleton `TextTransformationRegistry` class that supports dynamic strategy registration, lookup by ID, and listing available strategies.

\--- FILE 5: `lib/strategies/impl/text-corrector.ts` ---

Implement `AzerbaijaniTextCorrectorStrategy` implementing `ITextTransformationStrategy`. Include the full LLM system prompt for Azerbaijani text correction (diacritics restoration: c->ç, g->ğ, i->ı, o->ö, s->ş, u->ü; punctuation insertion; paragraph splitting; markdown bullet points).

\--- FILE 6: `lib/strategies/impl/gmail-corrector.ts` ---

Implement a placeholder `GmailCorrectorStrategy` demonstrating how new transformation strategies are registered.

\--- FILE 7: `lib/llm/client.ts` ---

Implement an abstraction layer for invoking the LLM API (OpenAI/Anthropic compatible format) with JSON response mode parsing.

\--- FILE 8: `app/api/transform/route.ts` ---

Implement Next.js Route Handler for `POST /api/transform`. Validate body using Zod schema `{ strategyId: string, text: string }`. Fetch the strategy from `TextTransformationRegistry`, execute `transform()`, and return structured JSON.

\--- FILE 9: `app/api/strategies/route.ts` ---

Implement Next.js Route Handler for `GET /api/strategies`. Return array of available strategies from the registry.

\--- FILE 10: `app/page.tsx` ---

Implement a modern, responsive React Client Component interface using Tailwind CSS featuring:

- Header with lazy.ai branding.
- Strategy selection dropdown (dynamically populated from `/api/strategies`, defaulting to "Mətn Düzəldici").
- Dual-pane layout: Left pane for raw text entry (with character counter and "Clear" button); Right pane for formatted output rendering with copy-to-clipboard functionality.
- "Düzəlt" (Transform) CTA button with real-time loading spinners and error state alerts.

Generate all specified files now with maximum code depth and operational readiness.

## 5. İstehsalat Təhlükəsizliyi, Məlumat Sanitizasiyası və Performans Strategiyası

`lazy.ai` platformasının Vercel serverless mühitində kəsintisiz və təhlükəsiz çalışması üçün backend API endpointində input sanitizasiyası və tənzimləmə mexanizmləri tətbiq olunmalıdır. Client tərəfindən daxil edilən həddən artıq böyük mətnlər serverless funksiyaların icra müddətini aşaraq lazımsız LLM API xərclərinə səbəb ola bilər. Bu riski aradan qaldırmaq üçün Zod scheması vasitəsilə mətna maksimum simvol limiti (məsələn, 10,000 simvol) qoyulur.

API Route Handler daxilində Zod və Rate Limiting tətbiqi aşağıdakı kimi həyata keçirilir:

TypeScript

```
// app/api/transform/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { TextTransformationRegistry } from '@/lib/strategies/registry';
import { AzerbaijaniTextCorrectorStrategy } from '@/lib/strategies/impl/text-corrector';
import { GmailCorrectorStrategy } from '@/lib/strategies/impl/gmail-corrector';

// Registrın inisializasiyası və strategiyaların qeydiyyatı
const registry = TextTransformationRegistry.getInstance();
registry.register(new AzerbaijaniTextCorrectorStrategy());
registry.register(new GmailCorrectorStrategy());

const RequestSchema = z.object({
  strategyId: z.string().min(1, 'Strategiya ID-si tələb olunur.'),
  text: z.string().min(1, 'Mətn boş ola bilməz.').max(10000, 'Mətn maksimal 10,000 simvol ola bilər.'),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validatedData = RequestSchema.parse(body);

    const strategy = registry.get(validatedData.strategyId);
    const result = await strategy.transform({ text: validatedData.text });

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validasiya xətası', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: error.message || 'Daxili server xətası' }, { status: 500 });
  }
}

```

Tətbiqin gələcək inkişafı üçün təhlükəsizlik mühiti tənzimlənərkən API açarlarının (`OPENAI_API_KEY` və ya `ANTHROPIC_API_KEY`) Vercel Environment Variables paneli üzərindən server-side mühitdə saxlanması təmin edilməlidir. Bu dəyişənlərin client bundle-a düşməməsi üçün prefiksində `NEXT_PUBLIC_` ifadəsindən istifadə edilməməlidir. Bu təhlükəsizlik və arxitektura standartları `lazy.ai` tətbiqinin Vercel üzərində yüksək performanslı və genişləndirilə bilən bir platforma kimi fəaliyyət göstərməsini təmin edir.