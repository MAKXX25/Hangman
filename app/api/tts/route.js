import { NextResponse } from 'next/server';

// In-memory cache for synthesized audio clips to ensure 0ms replay and conserve quota
const AUDIO_CACHE = new Map();

// Helper: Convert raw 16-bit little-endian PCM audio bytes into a valid RIFF WAV buffer
function pcmToWav(pcmBuffer, sampleRate = 24000, numChannels = 1, bitDepth = 16) {
  const byteRate = (sampleRate * numChannels * bitDepth) / 8;
  const blockAlign = (numChannels * bitDepth) / 8;
  const dataSize = pcmBuffer.length;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF chunk descriptor
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // "fmt " sub-chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size for PCM
  buffer.writeUInt16LE(1, 20);  // AudioFormat 1 = PCM
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitDepth, 34);

  // "data" sub-chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Write PCM audio data
  pcmBuffer.copy(buffer, 44);
  return buffer;
}

// Handler for TTS generation
async function handleTtsRequest(rawText, emotion = 'natural') {
  const clean = (rawText || '')
    .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1FA00}-\u{1FAFF}]/gu, '')
    .replace(/[*_~`]/g, '')
    .replace(/[^\w\s.,!?'"-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!clean || clean.length < 2) {
    return NextResponse.json({ error: 'Text too short or invalid' }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error: 'NO_API_KEY',
        message: 'GEMINI_API_KEY is not configured. Please add GEMINI_API_KEY to .env.local to enable Gemini Pulcherrima TTS.'
      },
      { status: 503 }
    );
  }

  const cacheKey = `${clean.toLowerCase()}:${emotion}`;
  if (AUDIO_CACHE.has(cacheKey)) {
    const cached = AUDIO_CACHE.get(cacheKey);
    return new Response(cached.buffer, {
      status: 200,
      headers: {
        'Content-Type': cached.mimeType,
        'Cache-Control': 'public, max-age=86400, immutable',
        'X-TTS-Source': 'cache-gemini-pulcherrima'
      }
    });
  }

  // Supported Gemini TTS models in prioritized fallback order
  const MODELS = [
    'gemini-2.5-flash-tts',
    'gemini-2.0-flash',
    'gemini-3.1-flash-tts-preview'
  ];

  let lastError = null;

  for (const model of MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const payload = {
        contents: [
          {
            parts: [
              {
                text: clean
              }
            ]
          }
        ],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: 'Pulcherrima'
              }
            }
          }
        }
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7000);

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        lastError = new Error(`Gemini API ${model} returned ${res.status}: ${errText}`);
        continue;
      }

      const data = await res.json();
      const candidate = data.candidates?.[0];
      const audioPart = candidate?.content?.parts?.find(p => p.inlineData && p.inlineData.data);

      if (!audioPart) {
        lastError = new Error(`No inline audio data returned by model ${model}`);
        continue;
      }

      const rawBase64 = audioPart.inlineData.data;
      const returnedMime = audioPart.inlineData.mimeType || 'audio/pcm;rate=24000';
      const rawBuffer = Buffer.from(rawBase64, 'base64');

      let finalBuffer = rawBuffer;
      let finalMime = 'audio/wav';

      if (returnedMime.includes('pcm')) {
        const rateMatch = returnedMime.match(/rate=(\d+)/);
        const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 24000;
        finalBuffer = pcmToWav(rawBuffer, sampleRate, 1, 16);
        finalMime = 'audio/wav';
      } else if (returnedMime.includes('wav')) {
        finalMime = 'audio/wav';
      } else if (returnedMime.includes('mp3') || returnedMime.includes('mpeg')) {
        finalMime = 'audio/mpeg';
      }

      // Store in memory cache (limit to 200 items to prevent unbounded memory growth)
      if (AUDIO_CACHE.size >= 200) {
        const firstKey = AUDIO_CACHE.keys().next().value;
        AUDIO_CACHE.delete(firstKey);
      }
      AUDIO_CACHE.set(cacheKey, { buffer: finalBuffer, mimeType: finalMime });

      return new Response(finalBuffer, {
        status: 200,
        headers: {
          'Content-Type': finalMime,
          'Cache-Control': 'public, max-age=86400, immutable',
          'X-TTS-Model': model,
          'X-TTS-Voice': 'Pulcherrima'
        }
      });
    } catch (err) {
      lastError = err;
    }
  }

  return NextResponse.json(
    {
      error: 'GENERATION_FAILED',
      message: lastError ? lastError.message : 'Failed to generate speech with Gemini Pulcherrima'
    },
    { status: 502 }
  );
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const text = searchParams.get('text') || '';
  const emotion = searchParams.get('emotion') || 'natural';
  return handleTtsRequest(text, emotion);
}

export async function POST(request) {
  try {
    const body = await request.json();
    const text = body.text || '';
    const emotion = body.emotion || 'natural';
    return handleTtsRequest(text, emotion);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
}
