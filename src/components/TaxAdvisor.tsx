import React, { useState, useRef, useEffect } from "react";
import { Sparkles, Send, FileText, Landmark, MessageSquare, ShieldAlert, BookOpen, AlertCircle, Play } from "lucide-react";
import { motion } from "motion/react";

interface ChatMessage {
  role: "user" | "model";
  text: string;
}

export default function TaxAdvisor() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "model",
      text: "سلام! من مشاور هوش مصنوعی مالی و مالیاتی صنعت ساختمان شما هستم. سوال خود را درباره قوانین بیمه، مالیات بر ارزش افزوده (۱۰٪)، گزارش‌های معاملات فصلی (ماده ۱۶۹)، یا بهای تمام شده پیمانکاری بپرسید تا با تطابق دقیق با قوانین مالیاتی ایران پاسخ دهم."
    }
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || isLoading) return;

    const userMsg = inputMessage;
    setInputMessage("");
    setMessages(prev => [...prev, { role: "user", text: userMsg }]);
    setIsLoading(true);

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMsg,
          history: messages
        })
      });

      const data = await response.json();
      if (data.reply) {
        setMessages(prev => [...prev, { role: "model", text: data.reply }]);
      } else {
        setMessages(prev => [...prev, { role: "model", text: "متأسفانه در حال حاضر قادر به پاسخگویی نیستم. لطفا چند لحظه دیگر امتحان فرمایید." }]);
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => [...prev, { role: "model", text: "خطایی در اتصال به سرور هوش مصنوعی رخ داد. با این حال بدانید که مهلت ارسال صورت معاملات فصلی ماده ۱۶۹ تا ۴۵ روز پس از پایان هر فصل می‌باشد." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const toFarsiDigits = (str: string | number) => {
    const farsiDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
    return String(str).replace(/[0-9]/g, (w) => farsiDigits[parseInt(w)]);
  };

  const quickQuestions = [
    "قوانین ارزش افزوده خرید مصالح ساختمانی چیست؟",
    "مهلت ارسال صورت معاملات فصلی ماده ۱۶۹ چقدر است؟",
    "استاندارد شماره ۹ حسابداری پیمانکاری ایران چیست؟",
    "تهاتر آپارتمان با اسکلت فلزی چه پیامد مالیاتی دارد؟"
  ];

  const selectQuickQuestion = (q: string) => {
    setInputMessage(q);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-right" dir="rtl">
      
      {/* Left Bento: Iranian Tax Compliance Knowledge Cards */}
      <div className="space-y-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-150 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <BookOpen className="w-5 h-5 text-teal-600" />
            <h3 className="font-bold text-slate-800 text-sm">راهنمای مالیاتی پیمانکاری ایران</h3>
          </div>

          <div className="space-y-3.5 text-xs">
            {/* Regulation Card 1 */}
            <div className="p-3 bg-teal-50/40 rounded-xl border border-teal-100 space-y-1">
              <span className="font-bold text-teal-800 text-[11px] block">۱. قانون مالیات بر ارزش افزوده (VAT)</span>
              <p className="text-slate-600 font-light leading-relaxed">
                نرخ ارزش افزوده در سال {toFarsiDigits(1403)} معادل {toFarsiDigits(10)}٪ می‌باشد. خرید مصالح از شرکت‌های معتبر که صورتحساب رسمی صادر می‌کنند به عنوان اعتبار مالیاتی برای شرکت سازنده قابل تهاتر است.
              </p>
            </div>

            {/* Regulation Card 2 */}
            <div className="p-3 bg-amber-50/40 rounded-xl border border-amber-100 space-y-1">
              <span className="font-bold text-amber-800 text-[11px] block">۲. ماده ۱۶۹ (معاملات فصلی)</span>
              <p className="text-slate-600 font-light leading-relaxed">
                سازندگان و پیمانکاران ملزم هستند صورت کلیه خریدها، هزینه‌ها، فروش‌ها و حواله‌های کارگاهی خود را تا حداکثر {toFarsiDigits(45)} روز پس از اتمام هر فصل در سامانه معاملات فصلی سازمان امور مالیاتی ثبت نمایند.
              </p>
            </div>

            {/* Regulation Card 3 */}
            <div className="p-3 bg-indigo-50/40 rounded-xl border border-indigo-100 space-y-1">
              <span className="font-bold text-indigo-800 text-[11px] block">۳. تهاترهای غیرنقدی و مالیات عملکرد</span>
              <p className="text-slate-600 font-light leading-relaxed">
                هرگونه تهاتر واحد ساختمانی با میلگرد یا خدمات پیمانکاران جزء، از نظر سازمان امور مالیاتی نوعی فروش نقدی واحد مسکونی تلقی شده و باید فاکتور رسمی خروجی با مالیات ارزش افزوده برای آن صادر و در سود سالانه اظهار شود.
              </p>
            </div>
          </div>
        </div>

        {/* Warning Indicator */}
        <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-3 text-xs">
          <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
          <div className="space-y-1 text-rose-800">
            <h4 className="font-bold">هشدار جدی جرایم مالیاتی:</h4>
            <p className="font-light leading-relaxed">عدم ارسال فاکتورها یا عدم ثبت در موعد مقرر معاملات فصلی منجر به جریمه غیرقابل بخشش معادل ۱٪ تا ۱۰٪ کل معاملات ابراز نشده خواهد شد.</p>
          </div>
        </div>
      </div>

      {/* Right Bento: Gemini AI Construction Financial Assistant */}
      <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-150 shadow-sm flex flex-col h-[520px] overflow-hidden">
        
        {/* Assistant Header */}
        <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400 animate-bounce" />
            <div>
              <h3 className="font-bold text-xs sm:text-sm">مشاور ارشد امور مالیاتی صنف ساختمان (Gemini AI)</h3>
              <p className="text-[10px] text-slate-400 font-light">پاسخگویی هوشمند به سوالات مالی کارفرمایان و پیمانکاران</p>
            </div>
          </div>
          <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-medium">پشتیبان مالیاتی</span>
        </div>

        {/* Messages Body */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-slate-50/50">
          {messages.map((msg, i) => {
            const isModel = msg.role === "model";
            return (
              <div 
                key={i} 
                className={`flex ${isModel ? "justify-start" : "justify-end"}`}
              >
                <div className={`max-w-[85%] p-3 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap shadow-xs ${
                  isModel 
                    ? "bg-white text-slate-800 border border-slate-150 rounded-tr-none" 
                    : "bg-indigo-600 text-white rounded-tl-none font-medium"
                }`}>
                  {msg.text}
                </div>
              </div>
            );
          })}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white text-slate-500 p-3 rounded-2xl text-xs border border-slate-150 rounded-tr-none flex items-center gap-2">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" />
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0.2s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0.4s]" />
                </div>
                مشاور در حال بررسی قوانین امور مالیاتی کشور...
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Quick Suggestion Chips */}
        <div className="p-3 bg-white border-t border-slate-100 overflow-x-auto whitespace-nowrap flex gap-2 scrollbar-thin">
          {quickQuestions.map(q => (
            <button 
              key={q}
              onClick={() => selectQuickQuestion(q)}
              className="px-3 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-full text-[10px] text-slate-600 transition-colors cursor-pointer inline-block shrink-0"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-slate-150 flex gap-2 items-center">
          <input 
            type="text" 
            placeholder="سوال مالیاتی خود را درباره پیمانکاران ساختمانی بپرسید..."
            value={inputMessage}
            onChange={e => setInputMessage(e.target.value)}
            disabled={isLoading}
            className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-indigo-500 focus:bg-white transition-all"
          />
          <button 
            type="submit"
            disabled={isLoading || !inputMessage.trim()}
            className="p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors disabled:bg-slate-200 disabled:text-slate-400 cursor-pointer"
          >
            <Send className="w-4 h-4 transform rotate-180" />
          </button>
        </form>
      </div>

    </div>
  );
}
