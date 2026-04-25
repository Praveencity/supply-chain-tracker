import React, { useState } from 'react';
import { MessageSquare, Send, X, Bot } from 'lucide-react';

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([{ text: "Hi! I'm your AI Control Tower assistant. Need to track a shipment?", isBot: true }]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg = input.trim();
    setMessages(prev => [...prev, { text: userMsg, isBot: false }]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('http://localhost:8000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg })
      });
      const data = await res.json();
      
      setMessages(prev => [...prev, { text: data.reply, isBot: true }]);
      setIsLoading(false);

    } catch (error) {
      setMessages(prev => [...prev, { text: "Connection error. Ensure the ML service is running.", isBot: true }]);
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <button 
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 p-4 rounded-full bg-brand-DEFAULT text-white shadow-xl hover:bg-brand-light transition-all z-50 ${isOpen ? 'hidden' : 'flex'}`}
      >
        <MessageSquare size={24} />
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-80 sm:w-96 glass-panel flex flex-col shadow-2xl z-50 overflow-hidden border border-brand-DEFAULT/30" style={{ height: '500px' }}>
          {/* Header */}
          <div className="bg-brand-dark/80 p-4 flex justify-between items-center border-b border-dark-700">
            <div className="flex items-center gap-2 text-white font-bold">
              <Bot size={20} /> AI Assistant
            </div>
            <button onClick={() => setIsOpen(false)} className="text-slate-300 hover:text-white">
              <X size={20} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-3">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.isBot ? 'justify-start' : 'justify-end'}`}>
                <div className={`max-w-[80%] p-3 rounded-xl text-sm ${msg.isBot ? 'bg-dark-700 text-slate-200 rounded-tl-none' : 'bg-brand-DEFAULT text-white rounded-tr-none'}`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-dark-700 text-slate-400 p-3 rounded-xl rounded-tl-none text-sm flex gap-1">
                  <span className="animate-bounce">.</span>
                  <span className="animate-bounce" style={{ animationDelay: '0.2s' }}>.</span>
                  <span className="animate-bounce" style={{ animationDelay: '0.4s' }}>.</span>
                </div>
              </div>
            )}
          </div>

          {/* Input Area */}
          <form onSubmit={sendMessage} className="p-3 border-t border-dark-700 bg-dark-800/50 flex gap-2">
            <input 
              type="text" 
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask about a shipment..." 
              className="flex-1 bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-DEFAULT"
            />
            <button type="submit" disabled={!input.trim()} className="bg-brand-DEFAULT hover:bg-brand-light text-white p-2 rounded-lg transition-colors disabled:opacity-50">
              <Send size={18} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
