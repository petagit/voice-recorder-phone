import axios from 'axios';

// Replace with your actual API key or use a backend proxy
const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

console.log('API Key Status:',
  OPENAI_API_KEY ? 'OpenAI Present' : 'OpenAI Missing',
  GEMINI_API_KEY ? 'Gemini Present' : 'Gemini Missing'
);

export const transcribeAudio = async (uri: string): Promise<string> => {
  try {
    const formData = new FormData();
    formData.append('file', {
      uri,
      type: 'audio/m4a',
      name: 'audio.m4a',
    } as any);
    formData.append('model', 'whisper-1');

    const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', formData, {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data.text;
  } catch (error) {
    console.error('Transcription error:', error);
    throw error;
  }
};

export const organizeText = async (text: string): Promise<{ bulletPoints: string[], messages: string[] }> => {
  if (!text || !text.trim()) {
    return {
      bulletPoints: [],
      messages: []
    };
  }

  console.log('Organizing text (Gemini 3):', text);

  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`,
      {
        contents: [{
          parts: [{
            text: `You are a helpful assistant. Organize the following text into bullet points and short messages. Return JSON with keys "bulletPoints" (array of strings) and "messages" (array of strings).\n\nText: ${text}`
          }]
        }],
        generationConfig: {
          responseMimeType: "application/json",
          thinkingConfig: {
            thinkingLevel: "high"
          }
        }
      },
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );

    const content = JSON.parse(response.data.candidates[0].content.parts[0].text);
    return content;
  } catch (error) {
    console.error('Organization error (Gemini):', error);
    if (axios.isAxiosError(error)) {
      console.error('Status:', error.response?.status);
      console.error('Data:', JSON.stringify(error.response?.data, null, 2));
    }
    return {
      bulletPoints: ['Error processing text', 'Check logs for details'],
      messages: ['Could not organize text.']
    };
  }
};

export const DEFAULT_TWITTER_PROMPT = 'You are a social media expert. Convert the following text into an engaging tweet. Keep it under 280 characters, use appropriate hashtags, and make it sound authentic and personal. Return only the tweet content.';

export const generateTweet = async (text: string, prompt: string = DEFAULT_TWITTER_PROMPT): Promise<string> => {
  if (!text || !text.trim()) {
    return '';
  }

  console.log('Generating tweet (Gemini 3):', text);

  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`,
      {
        contents: [{
          parts: [{
            text: `${prompt}\n\nText: ${text}`
          }]
        }],
        generationConfig: {
          thinkingConfig: {
            thinkingLevel: "high"
          }
        }
      },
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );

    return response.data.candidates[0].content.parts[0].text.trim();
  } catch (error) {
    console.error('Tweet generation error (Gemini):', error);
    return 'Error generating tweet.';
  }
};


