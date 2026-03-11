import { GEMINI_CONFIG } from '../config';
import { MonthlyTarget } from '../types';

interface SalesHistory {
  year: number;
  month: number;
  total: number;
}

interface AITargetSuggestion {
  target_amount: number;
  reasoning: string;
  confidence: number;
}

class GeminiAIService {
  private apiKey: string = '';
  private model: string = '';

  constructor() {}

  setApiKey(apiKey: string) {
    this.apiKey = apiKey;
  }

  setModel(model: string) {
    this.model = model;
  }

  getModel(): string {
    return this.model;
  }

  getApiKey(): string {
    return this.apiKey;
  }

  hasApiKey(): boolean {
    return this.apiKey && this.apiKey.trim().length > 0;
  }

  async generateTargetSuggestion(
    salesHistory: SalesHistory[],
    currentMonth: number,
    currentYear: number
  ): Promise<AITargetSuggestion> {
    if (!this.hasApiKey()) {
      throw new Error('Gemini API key not configured. Please set it in Settings.');
    }

    if (!this.model || this.model.trim() === '') {
      throw new Error('Gemini model not configured. Please set it in Settings.');
    }

    const prompt = this.buildPrompt(salesHistory, currentMonth, currentYear);

    try {
      const modelName = this.model.trim();
      const url = `${GEMINI_CONFIG.BASE_URL}/${modelName}:generateContent?key=${this.apiKey}`;
      console.log('Calling Gemini API with model:', modelName);
      
      const response = await fetch(
        url,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: prompt,
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 1000,
            },
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const data = await response.json();
      
      // Check for API errors in response
      if (data.error) {
        throw new Error(`Gemini API error: ${data.error.message}`);
      }
      
      const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!generatedText) {
        throw new Error('No response from Gemini');
      }

      console.log('AI Response:', generatedText);
      return this.parseAIResponse(generatedText);
    } catch (error) {
      console.error('Gemini AI Error:', error);
      throw error;
    }
  }

  private buildPrompt(salesHistory: SalesHistory[], month: number, year: number): string {
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'];

    const historyText = salesHistory
      .map((h) => `${monthNames[h.month - 1]} ${h.year}: Rs.${h.total.toLocaleString()}`)
      .join('\n');

    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;

    return `
You are a sales target advisor for a spare parts distribution business.

Based on the following sales history, analyze the trends and suggest a realistic monthly sales target for ${monthNames[nextMonth - 1]} ${nextYear}.

Sales History (last ${salesHistory.length} months):
${historyText}

Consider:
1. Growth trends - is sales increasing or decreasing?
2. Seasonal patterns - are there any months with higher/lower sales?
3. Average growth rate
4. Recent performance (last 3 months average)

Respond ONLY in JSON format with the following structure:
{
  "target_amount": <number>,
  "reasoning": "<2-3 sentence explanation>",
  "confidence": <number between 0-1>
}

Respond with valid JSON only, no additional text.
`;
  }

  private parseAIResponse(response: string): AITargetSuggestion {
    try {
      // Try to extract JSON from response
      let jsonStr = response.trim();
      
      // Remove markdown code blocks if present
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/```json?/g, '').replace(/```/g, '');
      }
      
      // Try to find JSON object in the response
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validate and return with defaults
      const targetAmount = parseFloat(parsed.target_amount) || parseFloat(parsed.target) || 0;
      
      return {
        target_amount: Math.round(targetAmount),
        reasoning: parsed.reasoning || parsed.reason || 'AI suggested target based on sales history',
        confidence: Math.max(0, Math.min(1, parseFloat(parsed.confidence) || 0.5)),
      };
    } catch (error) {
      console.error('Failed to parse AI response:', error);
      console.error('Raw response:', response);
      return {
        target_amount: 0,
        reasoning: 'Failed to parse AI response. Please try again.',
        confidence: 0,
      };
    }
  }
}

export const geminiAIService = new GeminiAIService();
export default geminiAIService;
