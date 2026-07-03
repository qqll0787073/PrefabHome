import React, { useState } from "react";
import { Product, QuoteRequest, Quotation, Message, Language } from "../types";
import { getTranslation } from "../utils/translation";
import { Heart, FileText, MessageSquare, Anchor, Info, AlertTriangle, Globe, Send, ShieldAlert, Sparkles, FolderLock } from "lucide-react";

interface BuyerDashboardProps {
  language: Language;
  savedProducts: Product[];
  onRemoveSave: (productId: string) => void;
  onViewProduct: (product: Product) => void;
  quoteRequests: QuoteRequest[];
  quotations: Quotation[];
  messages: Message[];
  onSendMessage: (text: string, toId: string) => void;
  onUpdateQuoteStatus: (quoteId: string, status: QuoteRequest["status"]) => void;
}

export default function BuyerDashboard({
  language,
  savedProducts,
  onRemoveSave,
  onViewProduct,
  quoteRequests,
  quotations,
  messages,
  onSendMessage,
  onUpdateQuoteStatus
}: BuyerDashboardProps) {
  const isZh = language === "zh";
  const [activeSubTab, setActiveSubTab] = useState<"saved" | "quotes" | "messages" | "shipping">("quotes");

  // Messaging state
  const [selectedMfgId, setSelectedMfgId] = useState<string>("mfg_sz_tiny");
  const [mfgMsgInput, setMfgMsgInput] = useState("");
  const [translatingMsgId, setTranslatingMsgId] = useState<string | null>(null);
  const [translatedCache, setTranslatedCache] = useState<Record<string, string>>({});

  const mfgList = [
    { id: "mfg_sz_tiny", name: "Shenzhen Minimalist Tiny Home Tech" },
    { id: "mfg_hz_modular", name: "Hangzhou Smart Modular Housing" },
    { id: "mfg_qd_steel", name: "Qingdao Heavy Steel Modular Villas" }
  ];

  // Filter messages for active chat
  const chatMessages = messages.filter(
    (m) => (m.fromId === "buyer_mark" && m.toId === selectedMfgId) || (m.fromId === selectedMfgId && m.toId === "buyer_mark")
  );

  const handleSendChat = () => {
    if (!mfgMsgInput.trim()) return;
    onSendMessage(mfgMsgInput, selectedMfgId);
    setMfgMsgInput("");
  };

  // Live dynamic translation via Express API
  const handleTranslateMessage = async (msgId: string, text: string) => {
    setTranslatingMsgId(msgId);
    try {
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text,
          targetLang: isZh ? "zh" : "en"
        })
      });
      const data = await response.json();
      if (data.translatedText) {
        setTranslatedCache(prev => ({ ...prev, [msgId]: data.translatedText }));
      }
    } catch (err) {
      console.error("Live translation error:", err);
    } finally {
      setTranslatingMsgId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      
      {/* Title Header banner */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row justify-between items-start md:items-center shadow-lg border border-slate-800">
        <div>
          <span className="text-xs text-amber-400 font-bold tracking-widest uppercase">{isZh ? "买家工作区" : "BUYER CENTRAL"}</span>
          <h2 className="font-sans font-black text-2xl tracking-tight mt-1">{isZh ? "您的北美项目控制台" : "Your Modular Project Console"}</h2>
          <p className="text-xs text-slate-400 mt-1">{isZh ? "在这里查看您收藏的产品、跟踪厂家回传的报价单并进行在线中英对谈。" : "Track your saved listings, view factory quotes, and chat with China manufacturers."}</p>
        </div>
        <div className="flex space-x-3 mt-4 md:mt-0 text-xs">
          <div className="bg-white/10 px-4 py-2.5 rounded-xl border border-white/15 text-center">
            <span className="text-slate-400 block text-[10px] uppercase font-bold">{isZh ? "收藏产品" : "Saved Products"}</span>
            <strong className="text-lg text-white font-black">{savedProducts.length}</strong>
          </div>
          <div className="bg-white/10 px-4 py-2.5 rounded-xl border border-white/15 text-center">
            <span className="text-slate-400 block text-[10px] uppercase font-bold">{isZh ? "定制询盘" : "Quote Requests"}</span>
            <strong className="text-lg text-white font-black">{quoteRequests.length}</strong>
          </div>
        </div>
      </div>

      {/* Internal Subtabs */}
      <div className="flex border-b border-slate-100 overflow-x-auto space-x-1.5 pb-0.5">
        {[
          { key: "quotes", label: isZh ? "询盘与正式报价单" : "Inquiries & Quotes", count: quoteRequests.length, icon: FileText },
          { key: "saved", label: isZh ? "收藏房型" : "Saved Homes", count: savedProducts.length, icon: Heart },
          { key: "messages", label: isZh ? "实时中英翻译对话" : "Factory Messages", count: chatMessages.length, icon: MessageSquare },
          { key: "shipping", label: isZh ? "清关政策与建规" : "US Compliance & Port Guidelines", count: 0, icon: Anchor }
        ].map((sub) => {
          const Icon = sub.icon;
          return (
            <button
              key={sub.key}
              onClick={() => setActiveSubTab(sub.key as any)}
              className={`flex items-center space-x-1.5 px-5 py-3 rounded-t-xl text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
                activeSubTab === sub.key
                  ? "border-slate-900 text-slate-900 bg-white"
                  : "border-transparent text-slate-500 hover:text-slate-900"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{sub.label}</span>
              {sub.count > 0 && (
                <span className="ml-1 bg-slate-100 text-slate-700 text-[10px] px-1.5 py-0.5 rounded-full font-extrabold">
                  {sub.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT: SAVED HOMES */}
      {activeSubTab === "saved" && (
        <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-2xs">
          {savedProducts.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              <Heart className="w-10 h-10 mx-auto text-slate-200 mb-3" />
              <p>{isZh ? "您尚未添加任何收藏型号。请返回产品列表浏览并在卡片上点击“收藏”。" : "No saved prefab homes yet. Browse listings and click the heart icon."}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {savedProducts.map((p) => (
                <div key={p.id} className="border border-slate-100 rounded-2xl overflow-hidden bg-slate-50/50 flex flex-col justify-between">
                  <div>
                    <img src={p.image} alt={p.name} className="aspect-video w-full object-cover" referrerPolicy="no-referrer" />
                    <div className="p-4 space-y-1">
                      <span className="text-[10px] uppercase text-amber-600 font-bold">{p.category}</span>
                      <h4 className="font-sans font-black text-slate-900 text-sm">{p.name}</h4>
                      <p className="text-xs text-slate-500 font-medium">FOB: ${p.price.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="p-4 bg-white border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                    <button
                      onClick={() => onViewProduct(p)}
                      className="py-1.5 text-center bg-slate-100 rounded-lg font-bold text-slate-700 hover:bg-slate-200 transition-colors"
                    >
                      {isZh ? "详细技术参数" : "View Specs"}
                    </button>
                    <button
                      onClick={() => onRemoveSave(p.id)}
                      className="py-1.5 text-center border border-rose-200 text-rose-600 rounded-lg font-bold hover:bg-rose-50 transition-colors"
                    >
                      {isZh ? "删除收藏" : "Remove"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: QUOTES & REQUESTS */}
      {activeSubTab === "quotes" && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-2xs space-y-4">
            <h3 className="font-sans font-bold text-slate-900 text-sm mb-4">{isZh ? "您提交的定制询盘及厂家答复" : "Your Active Inquiries & Quotation Documents"}</h3>
            
            {quoteRequests.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                <FileText className="w-10 h-10 mx-auto text-slate-200 mb-3" />
                <p>{isZh ? "暂无询盘记录。您可以在房型详情页里发起定制询盘。" : "No customized quotes requested yet."}</p>
              </div>
            ) : (
              <div className="space-y-4 text-xs text-slate-700">
                {quoteRequests.map((req) => {
                  const mfgQuotation = quotations.find(q => q.quoteRequestId === req.id);
                  return (
                    <div key={req.id} className="border border-slate-100 rounded-2xl overflow-hidden shadow-3xs bg-white divide-y divide-slate-100">
                      
                      {/* Top Header line of Inquiry */}
                      <div className="p-4 bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 block uppercase">Inquiry ID: #{req.id} | {req.date}</span>
                          <h4 className="font-sans font-black text-slate-900 text-sm mt-0.5">
                            {req.productModel} ({req.quantity} {isZh ? "台" : "Unit"})
                          </h4>
                          <span className="text-slate-500 font-medium mt-1 block">
                            {isZh ? "接收工厂" : "Factory"}: <strong>{req.manufacturerName}</strong>
                          </span>
                        </div>
                        <div className="mt-2.5 sm:mt-0 flex items-center space-x-2">
                          <span className={`px-2.5 py-1 rounded-full font-bold text-[10px] tracking-wide uppercase ${
                            req.status === "quotation_sent"
                              ? "bg-amber-100 text-amber-800 border border-amber-200"
                              : req.status === "ordered"
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                              : "bg-slate-100 text-slate-700 border border-slate-200"
                          }`}>
                            {req.status === "submitted" && (isZh ? "询盘已送达" : "Submitted")}
                            {req.status === "quotation_sent" && (isZh ? "厂家已出具报价单" : "Quotation Sent")}
                            {req.status === "ordered" && (isZh ? "订单已支付/已开工" : "Deposit Paid / Active Order")}
                          </span>
                        </div>
                      </div>

                      {/* Inquiry Requirements summary */}
                      <div className="p-4 bg-white grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <p><strong>{isZh ? "项目交付地" : "Project Destination"}:</strong> {req.projectLocation} (ZIP: {req.zipCode || "78701"})</p>
                          <p><strong>{isZh ? "采购预算" : "Stated Budget"}:</strong> ${req.budget.toLocaleString()}</p>
                          <p><strong>{isZh ? "土地拥有状态" : "Land Ownership Status"}:</strong> {req.landStatus === "owned" ? (isZh ? "已买地" : "Owned") : (isZh ? "寻地中" : "Searching")}</p>
                          {req.customizationRequest && (
                            <p className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 leading-relaxed text-slate-600 mt-2">
                              <strong>{isZh ? "定制化诉求描述" : "Customization Details"}:</strong> {req.customizationRequest}
                            </p>
                          )}
                        </div>

                        {/* Uploaded attachments list */}
                        <div>
                          <span className="block font-bold text-slate-500 mb-1.5">{isZh ? "附件图纸与场地航照" : "Attachments / CAD blueprints"}</span>
                          {req.uploadedFiles.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {req.uploadedFiles.map((f, i) => (
                                <span key={i} className="bg-slate-100 text-slate-700 font-semibold px-2 py-1 rounded border border-slate-200/50">
                                  📄 {f}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">{isZh ? "无附件" : "No files uploaded"}</span>
                          )}
                        </div>
                      </div>

                      {/* Associated Quotation Document Box */}
                      {mfgQuotation && (
                        <div className="p-5 bg-amber-50/40 border-t border-amber-100 space-y-4">
                          <div className="flex justify-between items-center border-b border-amber-100/60 pb-2">
                            <h5 className="font-sans font-extrabold text-xs text-amber-800 flex items-center space-x-1">
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>{isZh ? "中国工厂正式核价报价单" : "Official Factory Pro-Forma Invoice (Quotation)"}</span>
                            </h5>
                            <span className="text-[10px] font-bold text-amber-700">Date Issued: {mfgQuotation.date}</span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs text-slate-700">
                            <div>
                              <span className="block text-slate-400">{isZh ? "基础出厂总价" : "FOB Factory Total"}</span>
                              <strong className="text-slate-900 font-bold">${mfgQuotation.basePrice.toLocaleString()}</strong>
                            </div>
                            <div>
                              <span className="block text-slate-400">{isZh ? "定制与配件附加费" : "Customization Cost"}</span>
                              <strong className="text-slate-900 font-bold">${mfgQuotation.customizationCost.toLocaleString()}</strong>
                            </div>
                            <div>
                              <span className="block text-slate-400">{isZh ? "核算清关与海运物流费" : "Ocean & Overland Shipping"}</span>
                              <strong className="text-slate-900 font-bold">${mfgQuotation.estimatedShippingCost.toLocaleString()}</strong>
                            </div>
                            <div>
                              <span className="block text-slate-400">{isZh ? "到岸落地总价 (DDP 预估)" : "Total Est. Landed"}</span>
                              <strong className="text-amber-600 font-black text-sm">
                                ${(mfgQuotation.basePrice + mfgQuotation.customizationCost + mfgQuotation.estimatedShippingCost).toLocaleString()}
                              </strong>
                            </div>
                          </div>

                          <div className="space-y-1.5 text-xs text-slate-600 leading-relaxed border-t border-amber-100/50 pt-3">
                            <p><strong>{isZh ? "海外质保年限" : "Validity & Leadtime"}:</strong> {mfgQuotation.estimatedProductionTime} {isZh ? "天出厂" : "Production Days"} | {isZh ? "报价有效期" : "Validity"} {mfgQuotation.validityPeriod}</p>
                            <p><strong>{isZh ? "跨境付款条款" : "Payment Terms"}:</strong> {mfgQuotation.paymentTerms}</p>
                            {mfgQuotation.notes && <p><strong>{isZh ? "厂家特殊补充说明" : "Notes"}:</strong> {mfgQuotation.notes}</p>}
                          </div>

                          {/* CTA triggers */}
                          {req.status === "quotation_sent" && (
                            <div className="flex justify-end space-x-2 pt-2">
                              <button
                                onClick={() => onUpdateQuoteStatus(req.id, "cancelled")}
                                className="px-4 py-2 border border-slate-200 rounded-lg font-bold text-slate-600 hover:bg-slate-50"
                              >
                                {isZh ? "拒绝此方案" : "Decline Plan"}
                              </button>
                              
                              <button
                                onClick={() => setSelectedMfgId(req.manufacturerId)}
                                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 rounded-lg font-bold text-slate-900"
                              >
                                {isZh ? "联系厂家改价/沟通" : "Negotiate via Chat"}
                              </button>

                              <button
                                onClick={() => {
                                  onUpdateQuoteStatus(req.id, "ordered");
                                }}
                                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold shadow-xs"
                              >
                                {isZh ? "接受报价并支付定金 (模拟)" : "Accept & Pay Deposit"}
                              </button>
                            </div>
                          )}

                          {req.status === "ordered" && (
                            <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-xl flex items-center space-x-2 text-emerald-800 font-bold">
                              <span>✓</span>
                              <span>{isZh ? "定金已支付，工厂生产排单中。您可点击“实时中英对话”与厂家沟通设计详图。" : "Deposit cleared. Steel-frame fabrication started. Feel free to monitor design details in WeChat-style Chat below."}</span>
                            </div>
                          )}
                        </div>
                      )}

                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT: MESSAGING WORKSPACE WITH LIVE TRANSLATION */}
      {activeSubTab === "messages" && (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col md:flex-row h-[500px]">
          
          {/* Left: Contact List */}
          <div className="w-full md:w-1/3 border-r border-slate-100 bg-slate-50/50 flex flex-col divide-y divide-slate-100">
            <div className="p-4 bg-slate-100/50">
              <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wide">{isZh ? "源头中方厂家列表" : "Factory Contacts"}</h4>
            </div>
            {mfgList.map((m) => (
              <button
                key={m.id}
                onClick={() => setSelectedMfgId(m.id)}
                className={`p-4 text-left text-xs transition-all flex flex-col space-y-1 ${
                  selectedMfgId === m.id ? "bg-white border-l-4 border-amber-500 font-semibold text-slate-900" : "text-slate-600 hover:bg-slate-100/40"
                }`}
              >
                <strong>{m.name}</strong>
                <span className="text-[10px] text-slate-400">Export verified partner</span>
              </button>
            ))}
          </div>

          {/* Right: Message Stream */}
          <div className="flex-1 flex flex-col h-full bg-white justify-between">
            
            {/* Header chat metadata */}
            <div className="p-4 border-b border-slate-100 bg-slate-50/30 flex justify-between items-center">
              <div>
                <strong className="text-xs text-slate-900">{mfgList.find(m => m.id === selectedMfgId)?.name}</strong>
                <span className="text-[10px] text-emerald-500 block">● Factory Online Support</span>
              </div>
              <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-[9px] font-black uppercase">
                {isZh ? "翻译系统就绪" : "BILINGUAL AUTO TRANSLATE ENABLED"}
              </span>
            </div>

            {/* Chat message timeline */}
            <div className="flex-1 p-5 overflow-y-auto space-y-3.5 bg-slate-50/20">
              {chatMessages.length === 0 ? (
                <div className="text-center py-16 text-slate-300 text-xs">
                  <MessageSquare className="w-10 h-10 mx-auto text-slate-200 mb-2" />
                  <p>{isZh ? "没有消息记录。请发送您的第一个问询。" : "No messages yet. Send a greetings to start negotiations."}</p>
                </div>
              ) : (
                chatMessages.map((msg) => {
                  const isMe = msg.fromId === "buyer_mark";
                  const translationText = translatedCache[msg.id] || msg.translatedText;
                  return (
                    <div key={msg.id} className={`flex flex-col max-w-[80%] ${isMe ? "ml-auto items-end" : "mr-auto items-start"}`}>
                      <span className="text-[9px] text-slate-400 font-semibold mb-0.5">{msg.fromName} • {msg.timestamp}</span>
                      
                      <div className={`p-3.5 rounded-2xl text-xs leading-relaxed shadow-3xs ${
                        isMe ? "bg-slate-900 text-white rounded-tr-none" : "bg-white text-slate-800 border border-slate-100 rounded-tl-none"
                      }`}>
                        
                        {/* Main text */}
                        <p>{msg.text}</p>
                        
                        {/* Interactive translate buttons */}
                        {translationText ? (
                          <div className={`mt-2.5 pt-2 border-t text-[11px] leading-relaxed italic ${isMe ? "border-white/10 text-slate-300" : "border-slate-100 text-amber-700"}`}>
                            <strong>{isZh ? "AI翻译" : "Translation"}:</strong> {translationText}
                          </div>
                        ) : (
                          <button
                            onClick={() => handleTranslateMessage(msg.id, msg.text)}
                            disabled={translatingMsgId === msg.id}
                            className="mt-2 text-[10px] font-bold text-amber-500 hover:text-amber-600 flex items-center space-x-1"
                          >
                            <Globe className="w-3 h-3" />
                            <span>{translatingMsgId === msg.id ? (isZh ? "翻译中..." : "Translating...") : getTranslation(language, "translateBtn")}</span>
                          </button>
                        )}

                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Input bar */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center space-x-2">
              <input
                type="text"
                value={mfgMsgInput}
                onChange={(e) => setMfgMsgInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendChat()}
                placeholder={getTranslation(language, "typingMessage")}
                className="flex-1 bg-white border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800"
              />
              <button
                onClick={handleSendChat}
                className="p-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>

          </div>

        </div>
      )}

      {/* TAB CONTENT: SHIPPING POLICIES & US COMPLIANCE NOTES */}
      {activeSubTab === "shipping" && (
        <div className="space-y-6">
          
          {/* Detailed Legal and structural disclaimers */}
          <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-2xs space-y-6">
            <div className="border-b border-slate-100 pb-3 flex items-center space-x-2 text-slate-900">
              <ShieldAlert className="w-5 h-5 text-amber-500" />
              <h3 className="font-sans font-bold text-sm uppercase tracking-wide">{getTranslation(language, "legalDisclaimerHeader")}</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-slate-600 leading-relaxed">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                <strong className="text-slate-800 block text-xs font-black">1. {isZh ? "并非持牌工程建商" : "We are NOT licensed general builders"}</strong>
                <p>{getTranslation(language, "disclaimer1")}</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                <strong className="text-slate-800 block text-xs font-black">2. {isZh ? "建规(Zoning)与后院红线" : "Zoning ordinances & Setback codes"}</strong>
                <p>{getTranslation(language, "disclaimer2")}</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                <strong className="text-slate-800 block text-xs font-black">3. {isZh ? "港口清关费与平板拖车宽载" : "Port charges & Wide-load trucking"}</strong>
                <p>{getTranslation(language, "disclaimer3")}</p>
              </div>
            </div>
          </div>

          {/* Core order transactional journey */}
          <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-2xs space-y-4">
            <h3 className="font-sans font-bold text-slate-900 text-sm mb-4">{getTranslation(language, "orderFlowHeader")}</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs text-slate-600">
              <div className="border border-slate-100 p-4 rounded-2xl bg-slate-50/50 space-y-1">
                <h5 className="font-black text-slate-800 text-xs">{getTranslation(language, "step1")}</h5>
                <p className="leading-relaxed">{getTranslation(language, "step1Desc")}</p>
              </div>
              <div className="border border-slate-100 p-4 rounded-2xl bg-slate-50/50 space-y-1">
                <h5 className="font-black text-slate-800 text-xs">{getTranslation(language, "step2")}</h5>
                <p className="leading-relaxed">{getTranslation(language, "step2Desc")}</p>
              </div>
              <div className="border border-slate-100 p-4 rounded-2xl bg-slate-50/50 space-y-1">
                <h5 className="font-black text-slate-800 text-xs">{getTranslation(language, "step3")}</h5>
                <p className="leading-relaxed">{getTranslation(language, "step3Desc")}</p>
              </div>
              <div className="border border-slate-100 p-4 rounded-2xl bg-slate-50/50 space-y-1">
                <h5 className="font-black text-slate-800 text-xs">{getTranslation(language, "step4")}</h5>
                <p className="leading-relaxed">{getTranslation(language, "step4Desc")}</p>
              </div>
              <div className="border border-slate-100 p-4 rounded-2xl bg-slate-50/50 space-y-1">
                <h5 className="font-black text-slate-800 text-xs">{getTranslation(language, "step5")}</h5>
                <p className="leading-relaxed">{getTranslation(language, "step5Desc")}</p>
              </div>
              <div className="border border-slate-100 p-4 rounded-2xl bg-slate-50/50 space-y-1">
                <h5 className="font-black text-slate-800 text-xs">{getTranslation(language, "step6")}</h5>
                <p className="leading-relaxed">{getTranslation(language, "step6Desc")}</p>
              </div>
              <div className="border border-slate-100 p-4 rounded-2xl bg-slate-50/50 space-y-1">
                <h5 className="font-black text-slate-800 text-xs">{getTranslation(language, "step7")}</h5>
                <p className="leading-relaxed">{getTranslation(language, "step7Desc")}</p>
              </div>
              <div className="border border-slate-100 p-4 rounded-2xl bg-slate-50/50 space-y-1">
                <h5 className="font-black text-slate-800 text-xs">{getTranslation(language, "step8")}</h5>
                <p className="leading-relaxed">{getTranslation(language, "step8Desc")}</p>
              </div>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
