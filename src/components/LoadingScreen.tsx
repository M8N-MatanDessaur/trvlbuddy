import React, { useState, useEffect } from 'react';
import { Plane } from 'lucide-react';

const LoadingScreen: React.FC = () => {
  const [progress, setProgress] = useState(0);
  const [currentMessage, setCurrentMessage] = useState(0);

  const messages = [
    "Analyzing your destination...",
    "Finding the best activities...",
    "Learning local language phrases...",
    "Gathering emergency contacts...",
    "Personalizing your experience...",
    "Almost ready!"
  ];

  useEffect(() => {
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 95) return prev; // Don't complete until actual loading is done
        return prev + Math.random() * 15;
      });
    }, 800);

    const messageInterval = setInterval(() => {
      setCurrentMessage(prev => (prev + 1) % messages.length);
    }, 2000);

    return () => {
      clearInterval(progressInterval);
      clearInterval(messageInterval);
    };
  }, []);

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center">
      <div className="text-center max-w-md mx-auto px-4">
        <div className="relative mb-8">
          <Plane className="h-16 w-16 text-primary mx-auto animate-bounce" />
          <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2">
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
            </div>
          </div>
        </div>
        
        <h2 className="text-2xl font-bold mb-4 text-primary">Setting up your travel guide...</h2>
        <p className="text-main-secondary text-lg mb-8 min-h-[1.5rem] transition-all duration-500">
          {messages[currentMessage]}
        </p>
        
        <div className="max-w-sm mx-auto">
          <div className="bg-surface-container-high rounded-full h-3 mb-4 overflow-hidden">
            <div 
              className="progress-bar h-3 rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${Math.min(progress, 95)}%` }}
            />
          </div>
          <p className="text-sm text-main-secondary">
            {Math.round(Math.min(progress, 95))}% complete
          </p>
        </div>
        
        <div className="mt-8 p-4 bg-primary-container rounded-xl">
          <p className="text-sm text-on-primary-container">
            💡 <strong>Tip:</strong> We're using AI to create personalized content just for you. This ensures the best possible travel experience!
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;