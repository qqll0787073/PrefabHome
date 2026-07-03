import React, { useState } from "react";
import { Product, QuoteRequest, Quotation, Message, Language } from "../types";
import { getTranslation } from "../utils/translation";
import { PlusCircle, FileText, Settings, MessageSquare, Check, Sparkles, Building2, UploadCloud, Globe, Send, XCircle } from "lucide-react";

interface ManufacturerDashboardProps {
  language: Language;
  products: Product[];
  quoteRequests: QuoteRequest[];
  onAddProduct: (product: Omit<Product, "id" | "manufacturerId" | "manufacturerName">) => void;
  onCreateQuotation: (quotation: Omit<Quotation, "id" | "date">) => void;
  messages: Message[];
  onSendMessage: (text: string, toId: string) => void;
}

export default function ManufacturerDashboard({
  language,
  products,
  quoteRequests,
  onAddProduct,
  onCreateQuotation,
  messages,
  onSendMessage
}: ManufacturerDashboardProps) {
  const isZh = language === "zh";
  const [activeSubTab, setActiveSubTab] = useState<"listings" | "inquiries" | "add-listing" | "chat">("inquiries");

  // Filter products by the current logged-in manufacturer id ("mfg_sz_tiny" as default for simulation)
  const factoryId = "mfg_sz_tiny";
  const mfgProducts = products.filter(p => p.manufacturerId === factoryId);
  const mfgInquiries = quoteRequests.filter(q => q.manufacturerId === factoryId);

  // New Listing Form State
  const [newModel, setNewModel] = useState({
    name: "",
    modelNumber: "",
    category: "Tiny House",
    price: 30000,
    size: "8.5m x 2.4m x 3.8m",
    area: 250,
    bedrooms: 1,
    bathrooms: 1,
    hasKitchen: true,
    productionTime: 25,
    shippingAvailability: "Global Ports",
    image: "https://images.unsplash.com/photo-1544984243-ec57ea16fe25?auto=format&fit=crop&q=80&w=800",
    description: "",
    structureMaterial: "Light Gauge Steel Frame",
    wallMaterial: "PU Sandwich Panel Siding",
    roofMaterial: "Insulated Color Steel Sheeting",
    windowType: "Double Tempered Glass",
    insulation: "80mm Polyurethane foam",
    electricalSystem: "US NEC Standard Pre-wired",
    plumbingSystem: "US UPC Standard PEX Pipes",
    weight: 3500,
    requiredContainers: "1x 20GP",
    isCustomizable: true,
    isSuitableForOffGrid: true,
    isSuitableForAdu: true,
    warranty: "5-Year structural frame guarantee"
  });

  const [addSuccess, setAddSuccess] = useState(false);

  // Quote Generation Form State
  const [answeringInquiryId, setAnsweringInquiryId] = useState<string | null>(null);
  const [quotationForm, setQuotationForm] = useState({
    basePrice: 32500,
    customizationCost: 4000,
    estimatedShippingCost: 5500,
    estimatedProductionTime: 25,
    paymentTerms: "50% deposit to start production, 50% paid after video inspection prior to loading container.",
    validityPeriod: "30 Days",
    notes: "Wiring and plumbing completely comply with US NEC/UPC standards."
  });

  // Messaging State
  const [selectedBuyerId, setSelectedBuyerId] = useState("buyer_mark");
  const [msgInput, setMsgInput] = useState("");
  const [translatingMsgId, setTranslatingMsgId] = useState<string | null>(null);
  const [translatedCache, setTranslatedCache] = useState<Record<string, string>>({});

  const chatMessages = messages.filter(
    (m) => (m.fromId === factoryId && m.toId === selectedBuyerId) || (m.fromId === selectedBuyerId && m.toId === factoryId)
  );

  const handleSendChat = () => {
    if (!msgInput.trim()) return;
    onSendMessage(msgInput, selectedBuyerId);
    setMsgInput("");
  };

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
      console.error(err);
    } finally {
      setTranslatingMsgId(null);
    }
  };

  const handleAddProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAddProduct({
      name: newModel.name,
      modelNumber: newModel.modelNumber,
      category: newModel.category,
      price: newModel.price,
      size: newModel.size,
      area: newModel.area,
      bedrooms: newModel.bedrooms,
      bathrooms: newModel.bathrooms,
      hasKitchen: newModel.hasKitchen,
      productionTime: newModel.productionTime,
      shippingAvailability: newModel.shippingAvailability,
      image: newModel.image,
      imageGallery: [newModel.image],
      floorPlan: "Integrated standard layout",
      description: newModel.description,
      structureMaterial: newModel.structureMaterial,
      wallMaterial: newModel.wallMaterial,
      roofMaterial: newModel.roofMaterial,
      windowType: newModel.windowType,
      insulation: newModel.insulation,
      electricalSystem: newModel.electricalSystem,
      plumbingSystem: newModel.plumbingSystem,
      weight: newModel.weight,
      requiredContainers: newModel.requiredContainers,
      isCustomizable: newModel.isCustomizable,
      isSuitableForOffGrid: newModel.isSuitableForOffGrid,
      isSuitableForAdu: newModel.isSuitableForAdu,
      warranty: newModel.warranty,
      certifications: ["CE", "ISO9001", "UL Listed Wire Components"]
    });
    setAddSuccess(true);
    setTimeout(() => {
      setAddSuccess(false);
      setActiveSubTab("listings");
    }, 2500);
  };

  const handleIssueQuotation = (inquiry: QuoteRequest) => {
    onCreateQuotation({
      quoteRequestId: inquiry.id,
      productId: inquiry.productId,
      productModel: inquiry.productModel,
      basePrice: quotationForm.basePrice,
      customizationCost: quotationForm.customizationCost,
      estimatedShippingCost: quotationForm.estimatedShippingCost,
      estimatedProductionTime: quotationForm.estimatedProductionTime,
      paymentTerms: quotationForm.paymentTerms,
      validityPeriod: quotationForm.validityPeriod,
      notes: quotationForm.notes
    });
    setAnsweringInquiryId(null);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      
      {/* Title Header */}
      <div className="bg-linear-to-r from-slate-900 to-amber-950 text-white rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row justify-between items-start md:items-center shadow-lg border border-slate-800">
        <div>
          <span className="text-xs text-amber-400 font-bold tracking-widest uppercase">{isZh ? "中国源头厂家后台" : "CHINESE EXPORT FACTORY HUB"}</span>
          <h2 className="font-sans font-black text-2xl tracking-tight mt-1">
            {isZh ? "深圳装配式移动集成住宅厂" : "Shenzhen Minimalist Tiny Home Tech Portal"}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {isZh ? "管理您对外展示的规格型号、核算并答复买家询盘、通过智能翻译面板进行外贸对谈。" : "Publish custom blueprints, issue formal pro-forma bills, and chat with buyers using live translate."}
          </p>
        </div>
        <div className="flex space-x-3 mt-4 md:mt-0 text-xs">
          <div className="bg-white/10 px-4 py-2.5 rounded-xl border border-white/15 text-center">
            <span className="text-slate-400 block text-[10px] uppercase font-bold">{isZh ? "已发布型号" : "Active Listings"}</span>
            <strong className="text-lg text-white font-black">{mfgProducts.length}</strong>
          </div>
          <div className="bg-white/10 px-4 py-2.5 rounded-xl border border-white/15 text-center">
            <span className="text-slate-400 block text-[10px] uppercase font-bold">{isZh ? "待处理询盘" : "New Leads"}</span>
            <strong className="text-lg text-white font-black">{mfgInquiries.filter(q => q.status === "submitted").length}</strong>
          </div>
        </div>
      </div>

      {/* Sub tabs */}
      <div className="flex border-b border-slate-100 overflow-x-auto space-x-1.5 pb-0.5">
        {[
          { key: "inquiries", label: isZh ? "买家定制询盘" : "Quote Inquiries", count: mfgInquiries.length, icon: FileText },
          { key: "listings", label: isZh ? "我的产品库" : "My Prefab Models", count: mfgProducts.length, icon: Building2 },
          { key: "add-listing", label: isZh ? "发布新房型" : "List New House", count: 0, icon: PlusCircle },
          { key: "chat", label: isZh ? "买家外贸对谈" : "Client Chats", count: chatMessages.length, icon: MessageSquare }
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

      {/* SUBTAB CONTENT: QUOTE INQUIRIES & GENERATOR */}
      {activeSubTab === "inquiries" && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-2xs space-y-4">
            <h3 className="font-sans font-bold text-slate-900 text-sm mb-4">{isZh ? "接收到的 U.S. 个人买家询盘" : "Direct U.S. Individual Buyer Inquiries"}</h3>
            
            {mfgInquiries.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                <FileText className="w-10 h-10 mx-auto text-slate-200 mb-2" />
                <p>{isZh ? "暂无询盘记录。" : "No buyer inquiries received yet."}</p>
              </div>
            ) : (
              <div className="space-y-6">
                {mfgInquiries.map((inq) => (
                  <div key={inq.id} className="border border-slate-100 rounded-2xl overflow-hidden shadow-3xs bg-white text-xs text-slate-700">
                    
                    {/* Inquiry Top Panel */}
                    <div className="bg-slate-50 p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between sm:items-center">
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold block uppercase">Leads ID: #{inq.id} | {inq.date}</span>
                        <h4 className="font-sans font-black text-slate-900 text-sm mt-0.5">{inq.productModel}</h4>
                        <span className="text-slate-500 font-medium block mt-1">
                          Buyer: <strong>{inq.buyerName}</strong> ({inq.buyerEmail})
                        </span>
                      </div>
                      <div className="mt-2.5 sm:mt-0 flex items-center space-x-2">
                        <span className={`px-2.5 py-0.5 rounded-full font-bold text-[9px] tracking-wide uppercase ${
                          inq.status === "quotation_sent" ? "bg-amber-100 text-amber-800" : inq.status === "ordered" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"
                        }`}>
                          {inq.status === "submitted" && (isZh ? "新询盘已送达" : "New Inquiry")}
                          {inq.status === "quotation_sent" && (isZh ? "正式报价单已发送" : "Quotation Sent")}
                          {inq.status === "ordered" && (isZh ? "买家已定金开工" : "Deposit Paid / Active Order")}
                        </span>
                      </div>
                    </div>

                    {/* Inquiry Details and Customizations */}
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <p><strong>{isZh ? "买家交付地址" : "Project Location"}:</strong> {inq.projectLocation} (ZIP: {inq.zipCode})</p>
                        <p><strong>{isZh ? "意向预算" : "Target Budget"}:</strong> ${inq.budget.toLocaleString()}</p>
                        <p><strong>{isZh ? "买家土地性质" : "Land ownership"}:</strong> {inq.landStatus === "owned" ? (isZh ? "买家自备土地" : "Land Owned") : (isZh ? "选址寻租中" : "Searching")}</p>
                        {inq.customizationRequest && (
                          <p className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 italic leading-relaxed text-slate-600 mt-2">
                            <strong>{isZh ? "买家提出的定制配置" : "Customization details"}:</strong> "{inq.customizationRequest}"
                          </p>
                        )}
                      </div>

                      {/* Attached files */}
                      <div>
                        <span className="block font-bold text-slate-500 mb-1.5">{isZh ? "买家附带图纸及场地现状" : "Attached files / Blueprints"}</span>
                        {inq.uploadedFiles.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {inq.uploadedFiles.map((fn, idx) => (
                              <span key={idx} className="bg-slate-100 text-slate-700 font-semibold px-2 py-1 rounded border border-slate-200">
                                📄 {fn}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">{isZh ? "无附件" : "No attachments from buyer"}</span>
                        )}
                      </div>
                    </div>

                    {/* Action Panel for responding */}
                    {inq.status === "submitted" && answeringInquiryId !== inq.id && (
                      <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                        <button
                          onClick={() => {
                            setAnsweringInquiryId(inq.id);
                            // Autofill quote form with default prices
                            setQuotationForm(prev => ({
                              ...prev,
                              basePrice: 32500,
                              customizationCost: inq.customizationRequest ? 4500 : 0
                            }));
                          }}
                          className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold shadow-xs transition-all"
                        >
                          {isZh ? "开始核对成本并出具报价" : "Assemble & Send Official Quote"}
                        </button>
                      </div>
                    )}

                    {/* Quotation generator drawer form */}
                    {answeringInquiryId === inq.id && (
                      <div className="p-5 bg-amber-50/50 border-t border-amber-100 space-y-4">
                        <h5 className="font-sans font-extrabold text-amber-900 text-xs uppercase tracking-wide border-b border-amber-100/60 pb-2">
                          {isZh ? "出具正式报价 pro-forma invoice" : "Issue Formal Pro-forma Invoice Details"}
                        </h5>
                        
                        <form onSubmit={(e) => { e.preventDefault(); handleIssueQuotation(inq); }} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-slate-600 font-bold mb-1">{isZh ? "产品基础 FOB 出厂价 (USD)" : "Base FOB Price ($)"}</label>
                            <input
                              type="number"
                              required
                              value={quotationForm.basePrice}
                              onChange={(e) => setQuotationForm({ ...quotationForm, basePrice: parseInt(e.target.value) || 0 })}
                              className="w-full border border-slate-200 rounded-lg p-2 bg-white"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-slate-600 font-bold mb-1">{isZh ? "配件与定制附加成本 (USD)" : "Customization Add-on ($)"}</label>
                            <input
                              type="number"
                              value={quotationForm.customizationCost}
                              onChange={(e) => setQuotationForm({ ...quotationForm, customizationCost: parseInt(e.target.value) || 0 })}
                              className="w-full border border-slate-200 rounded-lg p-2 bg-white"
                            />
                          </div>

                          <div>
                            <label className="block text-slate-600 font-bold mb-1">{isZh ? "核算到目的港物流海运费 (USD)" : "Shipping Cost ($)"}</label>
                            <input
                              type="number"
                              value={quotationForm.estimatedShippingCost}
                              onChange={(e) => setQuotationForm({ ...quotationForm, estimatedShippingCost: parseInt(e.target.value) || 0 })}
                              className="w-full border border-slate-200 rounded-lg p-2 bg-white"
                            />
                          </div>

                          <div>
                            <label className="block text-slate-600 font-bold mb-1">{isZh ? "生产交期 (天)" : "Production leadtime (days)"}</label>
                            <input
                              type="number"
                              value={quotationForm.estimatedProductionTime}
                              onChange={(e) => setQuotationForm({ ...quotationForm, estimatedProductionTime: parseInt(e.target.value) || 25 })}
                              className="w-full border border-slate-200 rounded-lg p-2 bg-white"
                            />
                          </div>

                          <div>
                            <label className="block text-slate-600 font-bold mb-1">{isZh ? "报价有效期" : "Validity Limit"}</label>
                            <input
                              type="text"
                              value={quotationForm.validityPeriod}
                              onChange={(e) => setQuotationForm({ ...quotationForm, validityPeriod: e.target.value })}
                              className="w-full border border-slate-200 rounded-lg p-2 bg-white"
                            />
                          </div>

                          <div>
                            <label className="block text-slate-600 font-bold mb-1">{isZh ? "付款条款条件" : "Payment Terms"}</label>
                            <input
                              type="text"
                              value={quotationForm.paymentTerms}
                              onChange={(e) => setQuotationForm({ ...quotationForm, paymentTerms: e.target.value })}
                              className="w-full border border-slate-200 rounded-lg p-2 bg-white"
                            />
                          </div>

                          <div className="sm:col-span-3">
                            <label className="block text-slate-600 font-bold mb-1">{isZh ? "技术补充说明与配置细项" : "Engineering specs / Notes"}</label>
                            <textarea
                              value={quotationForm.notes}
                              onChange={(e) => setQuotationForm({ ...quotationForm, notes: e.target.value })}
                              className="w-full border border-slate-200 rounded-lg p-2 h-16 bg-white"
                            />
                          </div>

                          <div className="sm:col-span-3 flex justify-end space-x-2 pt-2">
                            <button
                              type="button"
                              onClick={() => setAnsweringInquiryId(null)}
                              className="px-4 py-2 border border-slate-200 rounded-lg font-bold hover:bg-white"
                            >
                              {getTranslation(language, "cancel")}
                            </button>
                            <button
                              type="submit"
                              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg shadow-xs"
                            >
                              {isZh ? "签章并发送报价" : "Sign & Send Pro-Forma Invoice"}
                            </button>
                          </div>
                        </form>
                      </div>
                    )}

                  </div>
                ))}
              </div>
            )}

          </div>
        </div>
      )}

      {/* SUBTAB CONTENT: MY PRODUCTS */}
      {activeSubTab === "listings" && (
        <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-2xs space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-sans font-bold text-slate-900 text-sm">{getTranslation(language, "myProducts")}</h3>
            <button
              onClick={() => setActiveSubTab("add-listing")}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center space-x-1"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{getTranslation(language, "uploadProduct")}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {mfgProducts.map((p) => (
              <div key={p.id} className="border border-slate-100 rounded-2xl overflow-hidden bg-slate-50/50 flex flex-col justify-between text-xs">
                <div>
                  <img src={p.image} alt={p.name} className="aspect-video w-full object-cover" referrerPolicy="no-referrer" />
                  <div className="p-4 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-[10px] uppercase text-amber-600 font-bold">{p.category}</span>
                      <span className="bg-emerald-50 text-emerald-700 text-[9px] font-bold px-1.5 rounded">Active</span>
                    </div>
                    <h4 className="font-sans font-black text-slate-900 text-sm">{p.name}</h4>
                    <p className="text-slate-500 font-medium">Model: {p.modelNumber}</p>
                    <p className="text-slate-800 font-bold">FOB Price: ${p.price.toLocaleString()}</p>
                  </div>
                </div>
                <div className="p-4 bg-white border-t border-slate-100 flex justify-between items-center text-slate-400">
                  <span>{p.productionTime} {isZh ? "天交期" : "days leadtime"}</span>
                  <span className="font-bold text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-700">{p.requiredContainers}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUBTAB CONTENT: ADD HOUSE LISTING FORM */}
      {activeSubTab === "add-listing" && (
        <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-2xs space-y-6">
          <h3 className="font-sans font-bold text-slate-900 text-sm border-b border-slate-100 pb-3">{getTranslation(language, "addModelTitle")}</h3>
          
          {addSuccess ? (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl p-6 text-center space-y-2 max-w-sm mx-auto">
              <Check className="w-12 h-12 text-emerald-500 mx-auto" />
              <h5 className="font-bold">{isZh ? "产品发布成功！" : "Model Published Successfully!"}</h5>
              <p className="text-xs">{isZh ? "该型号正在由平台管理员进行技术参数审核。" : "Your listing model is sent to admin approval queues."}</p>
            </div>
          ) : (
            <form onSubmit={handleAddProductSubmit} className="space-y-4 text-xs text-slate-700">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-bold mb-1">{getTranslation(language, "modelName")}</label>
                  <input
                    type="text"
                    required
                    value={newModel.name}
                    onChange={(e) => setNewModel({ ...newModel, name: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2.5 bg-slate-50/50"
                    placeholder="e.g. Atlas Expandable Loft"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">{getTranslation(language, "modelNo")}</label>
                  <input
                    type="text"
                    required
                    value={newModel.modelNumber}
                    onChange={(e) => setNewModel({ ...newModel, modelNumber: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2.5 bg-slate-50/50"
                    placeholder="e.g. SC-400-ATL"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">{getTranslation(language, "category")}</label>
                  <select
                    value={newModel.category}
                    onChange={(e) => setNewModel({ ...newModel, category: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2.5 bg-slate-50/50"
                  >
                    <option value="Tiny House">Tiny House</option>
                    <option value="ADU">ADU</option>
                    <option value="Modular House">Modular House</option>
                    <option value="Container House">Container House</option>
                    <option value="Cabin">Cabin</option>
                    <option value="Garden Office">Garden Office</option>
                    <option value="Steel Villa">Steel Villa</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block font-bold mb-1">{getTranslation(language, "factoryFobPrice")}</label>
                  <input
                    type="number"
                    value={newModel.price}
                    onChange={(e) => setNewModel({ ...newModel, price: parseInt(e.target.value) || 0 })}
                    className="w-full border border-slate-200 rounded-lg p-2.5 bg-slate-50/50"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">{getTranslation(language, "size")}</label>
                  <input
                    type="text"
                    value={newModel.size}
                    onChange={(e) => setNewModel({ ...newModel, size: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2.5 bg-slate-50/50"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">{isZh ? "室内面积 (sq ft)" : "Area (sq ft)"}</label>
                  <input
                    type="number"
                    value={newModel.area}
                    onChange={(e) => setNewModel({ ...newModel, area: parseInt(e.target.value) || 0 })}
                    className="w-full border border-slate-200 rounded-lg p-2.5 bg-slate-50/50"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">{getTranslation(language, "productionTime")}</label>
                  <input
                    type="number"
                    value={newModel.productionTime}
                    onChange={(e) => setNewModel({ ...newModel, productionTime: parseInt(e.target.value) || 25 })}
                    className="w-full border border-slate-200 rounded-lg p-2.5 bg-slate-50/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-bold mb-1">{getTranslation(language, "structure")}</label>
                  <input
                    type="text"
                    value={newModel.structureMaterial}
                    onChange={(e) => setNewModel({ ...newModel, structureMaterial: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2.5 bg-slate-50/50"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">{getTranslation(language, "wall")}</label>
                  <input
                    type="text"
                    value={newModel.wallMaterial}
                    onChange={(e) => setNewModel({ ...newModel, wallMaterial: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2.5 bg-slate-50/50"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">{getTranslation(language, "insulation")}</label>
                  <input
                    type="text"
                    value={newModel.insulation}
                    onChange={(e) => setNewModel({ ...newModel, insulation: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg p-2.5 bg-slate-50/50"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">{isZh ? "产品详细描述" : "Model Description"}</label>
                <textarea
                  value={newModel.description}
                  onChange={(e) => setNewModel({ ...newModel, description: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg p-2.5 bg-slate-50/50 h-20"
                  placeholder="Describe your structural advantages, electrical components, standard packaging etc."
                />
              </div>

              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setActiveSubTab("listings")}
                  className="px-5 py-3 rounded-xl border border-slate-200 font-bold"
                >
                  {getTranslation(language, "cancel")}
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 rounded-xl bg-slate-900 text-white font-bold"
                >
                  {isZh ? "确认上架审核" : "Publish Listing"}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* SUBTAB CONTENT: CHAT WORKSPACE */}
      {activeSubTab === "chat" && (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col md:flex-row h-[500px]">
          
          {/* Left sidebar */}
          <div className="w-full md:w-1/3 border-r border-slate-100 bg-slate-50/50 flex flex-col divide-y divide-slate-100">
            <div className="p-4 bg-slate-100/50">
              <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wide">{isZh ? "美方买家联系人" : "U.S. Buyers"}</h4>
            </div>
            <button
              onClick={() => setSelectedBuyerId("buyer_mark")}
              className={`p-4 text-left text-xs transition-all flex flex-col space-y-1 ${
                selectedBuyerId === "buyer_mark" ? "bg-white border-l-4 border-amber-500 font-semibold text-slate-900" : "text-slate-600 hover:bg-slate-100/40"
              }`}
            >
              <strong>Mark Harrison</strong>
              <span className="text-[10px] text-slate-400">Project: Austin, Texas</span>
            </button>
          </div>

          {/* Right messenger panel */}
          <div className="flex-1 flex flex-col h-full justify-between bg-white">
            <div className="p-4 border-b border-slate-100 bg-slate-50/30 flex justify-between items-center">
              <div>
                <strong className="text-xs text-slate-900">Mark Harrison</strong>
                <span className="text-[10px] text-emerald-500 block">● Active Client in Texas</span>
              </div>
              <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-[9px] font-black uppercase">
                {isZh ? "双语互译就绪" : "BILINGUAL AUTO TRANSLATION OK"}
              </span>
            </div>

            <div className="flex-1 p-5 overflow-y-auto space-y-3.5 bg-slate-50/20">
              {chatMessages.map((msg) => {
                const isMe = msg.fromId === factoryId;
                const translationText = translatedCache[msg.id] || msg.translatedText;
                return (
                  <div key={msg.id} className={`flex flex-col max-w-[80%] ${isMe ? "ml-auto items-end" : "mr-auto items-start"}`}>
                    <span className="text-[9px] text-slate-400 font-semibold mb-0.5">{msg.fromName} • {msg.timestamp}</span>
                    
                    <div className={`p-3.5 rounded-2xl text-xs leading-relaxed shadow-3xs ${
                      isMe ? "bg-slate-900 text-white rounded-tr-none" : "bg-white text-slate-800 border border-slate-100 rounded-tl-none"
                    }`}>
                      <p>{msg.text}</p>
                      
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
              })}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center space-x-2">
              <input
                type="text"
                value={msgInput}
                onChange={(e) => setMsgInput(e.target.value)}
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

    </div>
  );
}
