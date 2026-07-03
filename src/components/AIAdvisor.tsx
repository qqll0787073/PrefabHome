import React, { useState, useRef, useEffect } from "react";
import { Language } from "../types";
import { getTranslation } from "../utils/translation";
import { Bot, User, Send, HelpCircle, ShieldAlert, ChevronRight, Loader2 } from "lucide-react";

interface AIAdvisorProps {
  language: Language;
}

interface Message {
  id: string;
  sender: "user" | "bot";
  text: string;
  timestamp: string;
}

const SAMPLE_PROMPTS = [
  {
    en: "I have 2 acres in Texas. Budget is $80k. Need 3 bedrooms and 2 bathrooms.",
    zh: "我在德州有2英亩地。预算8万美元。想要3房2卫。"
  },
  {
    en: "What are the zoning or permit requirements for an ADU in Los Angeles, California?",
    zh: "在加州洛杉矶建后院小屋 (ADU) 需要什么建规许可？"
  },
  {
    en: "Explain the container shipping, customs duty, and crane assembly process for prefab homes.",
    zh: "请介绍一下预制房的集装箱船运、海关关税和现场吊起组装流程。"
  },
  {
    en: "Which modular home works best for off-grid setup with solar panel inputs?",
    zh: "哪种模块化房屋最适合加装太阳能并搭建成离网系统？"
  }
];

export default function AIAdvisor({ language }: AIAdvisorProps) {
  const isZh = language === "zh";
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      sender: "bot",
      text: getTranslation(language, "aiAdvisorWelcome"),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, loading]);

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim()) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue("");
    setLoading(true);

    try {
      const response = await fetch("/api/advisor", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          query: textToSend,
          budget: 80000, // sample
          state: "TX",   // sample
          zipCode: "75001",
          landStatus: "owned",
          previousMessages: messages.slice(-6) // Send recent history for context
        })
      });

      const data = await response.json();
      
      const botMsg: Message = {
        id: `bot-${Date.now()}`,
        sender: "bot",
        text: data.text || "I apologize, I am unable to connect to the advisor backend right now.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (error) {
      console.error("Advisor request error:", error);
      const errorMsg: Message = {
        id: `bot-err-${Date.now()}`,
        sender: "bot",
        text: isZh 
          ? "非常抱歉，网络连接异常，未能获取到 AI 顾问的最新答复。请检查服务配置并重试。" 
          : "I apologize, but we've encountered a connection issue fetching advice from Gemini. Please check connection and try again.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      
      {/* Visual Title */}
      <div className="bg-linear-to-r from-slate-900 to-amber-950 text-white rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center shadow-lg border border-slate-800">
        <div className="space-y-2">
          <span className="bg-amber-400 text-slate-950 font-black text-[10px] tracking-wider uppercase px-2.5 py-0.5 rounded-md inline-block">
            Gemini Flash 3.5 Active
          </span>
          <h2 className="font-sans font-black text-2xl tracking-tight">
            {getTranslation(language, "aiAdvisorTitle")}
          </h2>
          <p className="text-xs text-slate-300 max-w-lg leading-relaxed">
            {isZh 
              ? "中美跨境预制房屋建规、集装箱清关、卡车托运以及现场吊装工程的智能参谋。" 
              : "Ask about modular shipping, zoning, California Title 24, foundation specs, or general setup steps."}
          </p>
        </div>
        <div className="mt-4 sm:mt-0 w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center border border-white/15 shadow-inner">
          <Bot className="w-6 h-6 text-amber-400" />
        </div>
      </div>

      {/* Main chat window */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm flex flex-col h-[520px] overflow-hidden">
        
        {/* Chat Stream Panel */}
        <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-slate-50/50">
          {messages.map((msg) => (
            <div 
              key={msg.id} 
              className={`flex items-start space-x-3 max-w-[85%] ${msg.sender === "user" ? "ml-auto flex-row-reverse space-x-reverse" : "mr-auto"}`}
            >
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border shadow-2xs ${
                msg.sender === "user" 
                  ? "bg-slate-900 text-white border-slate-800" 
                  : "bg-amber-100 text-amber-900 border-amber-200"
              }`}>
                {msg.sender === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4 text-amber-600" />}
              </div>
              
              <div className="space-y-1">
                <div className={`rounded-2xl p-4 text-xs leading-relaxed shadow-3xs whitespace-pre-wrap ${
                  msg.sender === "user"
                    ? "bg-slate-900 text-white rounded-tr-none"
                    : "bg-white text-slate-800 border border-slate-100 rounded-tl-none"
                }`}>
                  {msg.text}
                </div>
                <span className={`text-[10px] text-slate-400 block px-1 ${msg.sender === "user" ? "text-right" : "text-left"}`}>
                  {msg.timestamp}
                </span>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center shadow-2xs">
                <Bot className="w-4 h-4 text-amber-600" />
              </div>
              <div className="bg-white border border-slate-100 rounded-2xl p-4 flex items-center space-x-2 text-slate-400 text-xs">
                <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                <span>{isZh ? "AI 正在研判建规、计算物流费用中..." : "Analyzing US building code standards..."}</span>
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>

        {/* Floating Quick Template prompts */}
        <div className="bg-white border-t border-slate-100 p-3 flex space-x-2 overflow-x-auto">
          {SAMPLE_PROMPTS.map((promptObj, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(isZh ? promptObj.zh : promptObj.en)}
              className="px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-[11px] font-medium border border-slate-200/60 whitespace-nowrap transition-colors flex items-center shrink-0"
            >
              <span>{isZh ? promptObj.zh.substring(0, 18) + "..." : promptObj.en.substring(0, 30) + "..."}</span>
              <ChevronRight className="w-3 h-3 text-slate-400 ml-1" />
            </button>
          ))}
        </div>

        {/* Input panel */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center space-x-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend(inputValue)}
            placeholder={getTranslation(language, "aiPlaceholder")}
            className="flex-1 bg-white border border-slate-200 rounded-xl p-3 text-xs outline-hidden focus:ring-1 focus:ring-slate-900 text-slate-800"
          />
          <button
            onClick={() => handleSend(inputValue)}
            disabled={loading}
            className="p-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl transition-colors shadow-xs disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

      </div>

      {/* Advisory warnings */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start space-x-3 text-xs text-amber-800 shadow-3xs">
        <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
        <div>
          <h4 className="font-bold mb-1">{isZh ? "建规审查重要安全申明" : "Legal Safety Disclaimer"}</h4>
          <p className="leading-relaxed">
            {getTranslation(language, "aiDisclaimer")}
          </p>
        </div>
      </div>

    </div>
  );
}
