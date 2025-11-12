
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI } from "@google/genai";
import type { Chat } from "@google/genai";
import type { Message } from './types';
import { UploadIcon, SendIcon, SparklesIcon } from './components/icons';

const SYSTEM_INSTRUCTION = `You are a compassionate and patient Socratic math tutor. Your goal is to help students learn by guiding them, not by giving them answers.
When you are given a math problem (calculus, algebra, etc.):
1. Analyze the problem carefully.
2. Provide ONLY the very first conceptual step to solve the problem. Do not perform the calculation, just describe the step. For example, say "First, we should apply the chain rule to the outer function," not "The derivative is...".
3. After providing a step, wait for the student's response.
4. If the student asks "Why did we do that?", "Why?", or a similar question, explain the mathematical concept or rule behind that specific step in a clear, simple, and encouraging way.
5. If the student attempts the step and is correct, affirm them and guide them to the very next conceptual step.
6. If the student is incorrect, gently correct their mistake, explain the reasoning, and guide them back to the correct path.
7. Maintain a supportive and encouraging tone. Keep responses concise and focused on one step at a time. Do not solve the entire problem unless the student has successfully completed all steps.`;

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chat, setChat] = useState<Chat | null>(null);
  const [showWhyButton, setShowWhyButton] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([
      {
        id: 'initial-ai-message',
        sender: 'ai',
        type: 'text',
        content: "Hello! I'm your friendly math tutor. Stuck on a problem? Upload a photo, and we'll solve it together, one step at a time."
      }
    ]);
  }, []);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const fileToBase64 = (file: File): Promise<{mimeType: string, data: string}> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        const [mimeType, data] = result.split(/,|;/);
        resolve({ mimeType: file.type, data: result.split(',')[1] });
      };
      reader.onerror = (error) => reject(error);
    });

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setShowWhyButton(false);
    const userImageMessage: Message = {
      id: `user-${Date.now()}`,
      sender: 'user',
      type: 'image',
      content: URL.createObjectURL(file),
      mimeType: file.type
    };
    setMessages([userImageMessage]);
    setIsLoading(true);

    try {
      const { mimeType, data: base64Data } = await fileToBase64(file);
      if (!mimeType.startsWith('image/')) {
        throw new Error('Please upload a valid image file.');
      }
      
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      const newChat = ai.chats.create({
        model: 'gemini-2.5-pro',
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          thinkingConfig: { thinkingBudget: 32768 }
        },
      });
      setChat(newChat);

      const response = await newChat.sendMessage({
        message: {
          parts: [{
            inlineData: {
              mimeType,
              data: base64Data
            }
          }]
        }
      });

      const aiResponse: Message = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        type: 'text',
        content: response.text
      };
      setMessages(prev => [...prev, aiResponse]);
      setShowWhyButton(true);
    } catch (err) {
      console.error(err);
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setError(`Failed to analyze the image. ${errorMessage}`);
      setMessages([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = useCallback(async (messageText: string) => {
    if (!messageText.trim() || !chat) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      sender: 'user',
      type: 'text',
      content: messageText
    };
    setMessages(prev => [...prev, userMessage]);
    setUserInput('');
    setIsLoading(true);
    setError(null);
    setShowWhyButton(false);

    try {
      const response = await chat.sendMessage({ message: messageText });
      const aiResponse: Message = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        type: 'text',
        content: response.text
      };
      setMessages(prev => [...prev, aiResponse]);
      setShowWhyButton(true);
    } catch (err) {
      console.error(err);
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setError(`Failed to get a response. ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  }, [chat]);


  const renderMessageContent = (msg: Message) => {
    if (msg.type === 'image') {
      return (
        <div className="p-2 bg-gray-200 dark:bg-gray-700 rounded-lg">
          <img src={msg.content} alt="Math problem" className="max-w-xs max-h-80 rounded-md object-contain" />
        </div>
      );
    }
    return (
      <div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{__html: msg.content.replace(/\n/g, '<br />')}} />
    );
  };
  
  return (
    <div className="flex flex-col h-screen font-sans bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
      <header className="flex items-center justify-center p-4 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <SparklesIcon className="w-6 h-6 text-indigo-500 mr-3" />
        <h1 className="text-xl font-bold tracking-tight">Socratic Math Tutor</h1>
      </header>

      <main ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex items-end gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.sender === 'ai' && <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">AI</div>}
            <div
              className={`max-w-lg lg:max-w-2xl px-4 py-3 rounded-2xl ${
                msg.sender === 'user'
                  ? 'bg-indigo-500 text-white rounded-br-none'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-bl-none'
              }`}
            >
              {renderMessageContent(msg)}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex items-end gap-3 justify-start">
            <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">AI</div>
            <div className="bg-gray-200 dark:bg-gray-700 px-4 py-3 rounded-2xl rounded-bl-none">
                <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-pulse"></div>
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-pulse [animation-delay:0.2s]"></div>
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-pulse [animation-delay:0.4s]"></div>
                </div>
            </div>
          </div>
        )}
        {error && <div className="text-red-500 text-center text-sm">{error}</div>}
      </main>

      <footer className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
        <div className="max-w-3xl mx-auto">
          {chat && showWhyButton && !isLoading && (
            <div className="flex justify-center mb-2">
              <button
                onClick={() => handleSendMessage("Why did we do that?")}
                className="px-4 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-gray-700 rounded-full hover:bg-indigo-200 dark:hover:bg-gray-600 transition-colors"
              >
                Why did we do that?
              </button>
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage(userInput);
            }}
            className="flex items-center gap-2"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-gray-500 dark:text-gray-400 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors rounded-full"
              aria-label="Upload an image"
            >
              <UploadIcon className="w-6 h-6" />
            </button>
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder={chat ? "What's your next step?" : "Upload a problem to start"}
              className="flex-1 w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={isLoading || !chat}
            />
            <button
              type="submit"
              className="p-2 text-gray-500 dark:text-gray-400 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading || !userInput.trim() || !chat}
              aria-label="Send message"
            >
              <SendIcon className="w-6 h-6" />
            </button>
          </form>
        </div>
      </footer>
    </div>
  );
};

export default App;
