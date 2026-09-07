"use client";

import React, { useState, useEffect, useRef } from "react";
import { Lesson, api, SenseiChatMessage } from "@/lib/api";
import {
  Bot, Sparkles, Send, RotateCw, Lightbulb, Zap, HelpCircle,
  CheckCircle2, User, Loader2
} from "lucide-react";

interface AiSenseiWidgetProps {
  lesson: Lesson;
  courseTitle?: string;
  sectionTitle?: string;
  jlptLevel?: string;
}

export const AiSenseiWidget: React.FC<AiSenseiWidgetProps> = ({
  lesson,
  courseTitle,
  sectionTitle,
  jlptLevel = "N3",
}) => {
  const [messages, setMessages] = useState<SenseiChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestedPrompts, setSuggestedPrompts] = useState<string[]>([
    "💡 Tại sao 3 chữ 木 thành 森?",
    "⚡ Cách nhớ nhanh 50 bộ thủ đầu",
  ]);

  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Set initial welcome greeting and suggested prompts when lesson changes
  useEffect(() => {
    const initialGreeting = `Kon'nichiwa Kenji-san! Cần giải thích thêm về bộ Mộc (木) hay bí quyết nhớ chữ 森 (Sâm) trong video không nè?`;
    setMessages([
      {
        role: "assistant",
        content: initialGreeting,
      },
    ]);
    setSuggestedPrompts([
      "💡 Tại sao 3 chữ 木 thành 森?",
      "⚡ Cách nhớ nhanh 50 bộ thủ đầu",
    ]);
  }, [lesson.id]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text || loading) return;

    const userMsg: SenseiChatMessage = { role: "user", content: text };
    const updatedHistory = [...messages, userMsg];
    setMessages(updatedHistory);
    setInputValue("");
    setLoading(true);

    try {
      const response = await api.askAiSensei({
        message: text,
        lessonTitle: lesson.title,
        courseTitle: courseTitle,
        sectionTitle: sectionTitle,
        jlptLevel: jlptLevel,
        history: updatedHistory.slice(-6),
      });

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: response.reply,
        },
      ]);

      if (response.suggestedQuestions && response.suggestedQuestions.length > 0) {
        setSuggestedPrompts(response.suggestedQuestions);
      }
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Gomen ne! Sensei gặp sự cố mạng nhỏ khi kết nối. Bạn hãy thử hỏi lại nhé! 🎌",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleResetChat = () => {
    setMessages([
      {
        role: "assistant",
        content: `Kon'nichiwa! Sensei đã sẵn sàng giải đáp thắc mắc cho bài "${lesson.title}". Hãy đặt câu hỏi cho Sensei nhé! 🎌`,
      },
    ]);
    setSuggestedPrompts([
      "💡 Tại sao 3 chữ 木 thành 森?",
      "⚡ Cách nhớ nhanh 50 bộ thủ đầu",
    ]);
  };

  // Helper to highlight Kanji and special keywords in Markdown style
  const renderMessageContent = (content: string) => {
    // Replace markdown bold, and special patterns like bộ Mộc (木), 森 (Sâm)
    const lines = content.split("\n");
    return (
      <div className="flex flex-col gap-1.5 text-xs text-slate-800 dark:text-slate-100 leading-relaxed font-sans">
        {lines.map((line, idx) => {
          if (!line.trim()) return <div key={idx} className="h-1" />;
          return (
            <p key={idx} className="break-words">
              {line.split(" ").map((word, wIdx) => {
                // Highlight words with kanji in parentheses like (木), (森), (Sâm), (Mộc)
                if (word.includes("bộ") || word.includes("chữ") || word.includes("Mộc") || word.includes("木") || word.includes("森") || word.includes("Sâm")) {
                  if (word.includes("木") || word.includes("Mộc")) {
                    return (
                      <span key={wIdx} className="font-extrabold text-emerald-600 dark:text-emerald-400 mx-0.5">
                        {word}{" "}
                      </span>
                    );
                  }
                  if (word.includes("森") || word.includes("Sâm")) {
                    return (
                      <span key={wIdx} className="font-extrabold text-orange-600 dark:text-orange-400 mx-0.5">
                        {word}{" "}
                      </span>
                    );
                  }
                }
                if (word.startsWith("**") && word.endsWith("**")) {
                  return (
                    <strong key={wIdx} className="font-black text-slate-900 dark:text-white mx-0.5">
                      {word.replace(/\*\*/g, "")}{" "}
                    </strong>
                  );
                }
                return word + " ";
              })}
            </p>
          );
        })}
      </div>
    );
  };

  return (
    <div className="bento-card p-5 sm:p-6 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-1">
        <div className="flex items-center gap-3">
          {/* Avatar with purple bg + green online dot */}
          <div className="relative">
            <div className="w-10 h-10 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-500/20 shrink-0">
              <Bot className="w-5 h-5" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
                AI Sensei
              </h3>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-extrabold text-[10px] border border-amber-200/80 dark:border-amber-800">
                Trợ lý học
              </span>
            </div>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Đang nghe bài giảng cùng bạn
            </p>
          </div>
        </div>

        {/* Refresh button */}
        <button
          type="button"
          onClick={handleResetChat}
          className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          title="Bắt đầu lại đoạn hội thoại"
        >
          <RotateCw className="w-4 h-4" />
        </button>
      </div>

      {/* Messages Bubble Area */}
      <div ref={chatContainerRef} className="flex flex-col gap-3 max-h-72 overflow-y-auto pr-1">
        {messages.map((msg, index) => {
          const isSensei = msg.role === "assistant";
          return (
            <div
              key={index}
              className={`flex flex-col ${isSensei ? "items-start" : "items-end"}`}
            >
              <div
                className={`p-3.5 rounded-2xl max-w-[90%] shadow-2xs relative ${
                  isSensei
                    ? "bg-[#eff4ff] dark:bg-slate-800/80 border border-[#d3e4fe] dark:border-slate-700 rounded-tl-sm text-[#0b1c30] dark:text-slate-100"
                    : "bg-emerald-600 text-white rounded-tr-sm shadow-emerald-500/10"
                }`}
              >
                {isSensei ? (
                  renderMessageContent(msg.content)
                ) : (
                  <p className="text-xs font-semibold text-white break-words">{msg.content}</p>
                )}

                {/* Subtext timestamp */}
                {isSensei && (
                  <span className="block text-[9px] text-slate-400 text-right mt-1.5 font-medium">
                    Vừa xong
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {/* Typing Loading Indicator */}
        {loading && (
          <div className="flex items-center gap-2 p-3 rounded-2xl bg-[#eff4ff] dark:bg-slate-800/80 border border-[#d3e4fe] dark:border-slate-700 max-w-[65%]">
            <Loader2 className="w-3.5 h-3.5 text-purple-600 animate-spin" />
            <span className="text-[11px] text-slate-600 dark:text-slate-300 font-bold">Sensei đang giải thích...</span>
          </div>
        )}
      </div>

      {/* Quick Suggested Prompt Chips */}
      {suggestedPrompts.length > 0 && (
        <div className="flex flex-col gap-1.5 pt-1">
          <span className="text-[10px] font-extrabold text-amber-700 dark:text-amber-300">
            Gợi ý câu hỏi nhanh:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {suggestedPrompts.map((prompt, pIdx) => (
              <button
                key={pIdx}
                type="button"
                onClick={() => handleSendMessage(prompt.replace(/^[💡⚡📝❓]\s*/, ""))}
                className="px-3.5 py-1.5 rounded-full bg-[#eff4ff] hover:bg-[#dce9ff] dark:bg-slate-800/90 dark:hover:bg-slate-700 text-[#0b1c30] dark:text-slate-300 text-[11px] font-bold transition-all border border-[#d3e4fe] dark:border-slate-700 shadow-2xs active:scale-95 text-left cursor-pointer"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Form Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="flex items-center gap-2 pt-1"
      >
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Hỏi AI Sensei về ngữ pháp hoặc từ vựng..."
          className="flex-1 px-4 py-2.5 rounded-full bg-[#eff4ff] dark:bg-slate-800 text-xs text-[#0b1c30] dark:text-white placeholder:text-slate-400 border border-[#d3e4fe] dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-medium"
        />
        <button
          type="submit"
          disabled={!inputValue.trim() || loading}
          className="btn-tactile-emerald w-9 h-9 flex items-center justify-center shrink-0 disabled:opacity-40 cursor-pointer"
          title="Gửi câu hỏi"
        >
          <Send className="w-3.5 h-3.5 fill-white" />
        </button>
      </form>
    </div>
  );
};
