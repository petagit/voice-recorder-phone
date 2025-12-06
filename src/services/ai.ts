import axios from 'axios';

// Replace with your actual API key or use a backend proxy
const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;

console.log('API Key Status:', OPENAI_API_KEY ? 'Present' : 'Missing', OPENAI_API_KEY?.slice(0, 5));

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

  console.log('Organizing text:', text);

  try {
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant. Organize the following text into bullet points and short messages. Return JSON with keys "bulletPoints" (array of strings) and "messages" (array of strings).'
        },
        {
          role: 'user',
          content: text
        }
      ],
      response_format: { type: "json_object" }
    }, {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    const content = JSON.parse(response.data.choices[0].message.content);
    return content;
  } catch (error) {
    console.error('Organization error:', error);
    if (axios.isAxiosError(error)) {
      console.error('Status:', error.response?.status);
      console.error('Data:', JSON.stringify(error.response?.data, null, 2));
    }
    // Return mock data on error for demo purposes
    return {
      bulletPoints: ['Error processing text', 'Check logs for details'],
      messages: ['Could not organize text.']
    };
  }
};

export const generateTweet = async (text: string): Promise<string> => {
  if (!text || !text.trim()) {
    return '';
  }

  console.log('Generating tweet:', text);

  try {
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a social media expert. Convert the following text into an engaging tweet. Keep it under 280 characters, use appropriate hashtags, and make it sound authentic and personal. Return only the tweet content.'
        },
        {
          role: 'user',
          content: text
        }
      ],
    }, {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    return response.data.choices[0].message.content.trim();
  } catch (error) {
    console.error('Tweet generation error:', error);
    return 'Error generating tweet.';
  }
};
