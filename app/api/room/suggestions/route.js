import { NextResponse } from 'next/server';
import { getRandomSuggestions } from '../../../../lib/dictionary.js';

export async function GET() {
  try {
    const suggestions = getRandomSuggestions(12);
    return NextResponse.json({ success: true, suggestions });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
