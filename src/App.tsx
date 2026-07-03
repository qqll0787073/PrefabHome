import React, { useState } from "react";
import { 
  Product, 
  QuoteRequest, 
  Quotation, 
  Message, 
  Language, 
  UserRole, 
  ManufacturerProfile, 
  AdminLog 
} from "./types";
import { 
  INITIAL_MANUFACTURERS, 
  INITIAL_PRODUCTS, 
  INITIAL_QUOTES, 
  INITIAL_QUOTATIONS, 
  INITIAL_MESSAGES 
} from "./data";
import { getTranslation } from "./utils/translation";

// Components
import Header from "./components/Header";
import ProductCard from "./components/ProductCard";
import ProductDetailModal from "./components/ProductDetailModal";
import ProductComparison from "./components/ProductComparison";
import AIAdvisor from "./components/AIAdvisor";
import BuyerDashboard from "./components/BuyerDashboard";
import ManufacturerDashboard from "./components/ManufacturerDashboard";
import AdminDashboard from "./components/AdminDashboard";
import ImportCustomsCenter from "./components/ImportCustomsCenter";
import AuthPortal from "./components/AuthPortal";

// Icons
import { Search, SlidersHorizontal, ArrowLeftRight, Heart, Sparkles, Building, Bot, ShieldCheck, Check, RotateCcw } from "lucide-react";

const INITIAL_ADMIN_LOGS: AdminLog[] = [
  {
    id: "log_1",
    timestamp: "2026-07-03 08:30:15",
    action: "Platform Initialized",
    details: "Bilingual translation channels and zoning advising capabilities booted."
  },
  {
    id: "log_2",
    timestamp: "2026-07-03 08:31:00",
    action: "Factory Registered",
    details: "Wuhan SpacePod Space Capsule Cabin Co. submitted qualifications. Verification pending."
  }
];

export default function App() {
  // Global App States
  const [language, setLanguage] = useState<Language>("en");
  const [currentRole, setCurrentRole] = useState<UserRole>("buyer");
  const [currentView, setCurrentView] = useState<"browse" | "compare" | "advisor" | "dashboard" | "import-center">("browse");

  // Session Authentication state per role
  const [authenticatedUsers, setAuthenticatedUsers] = useState<Record<UserRole, { username: string; fullName: string; email: string } | null>>(() => {
    try {
      const saved = localStorage.getItem("prefab_sessions");
      return saved ? JSON.parse(saved) : { buyer: null, manufacturer: null, admin: null };
    } catch {
      return { buyer: null, manufacturer: null, admin: null };
    }
  });

  const handleLoginSuccess = (role: UserRole, username: string, fullName: string, email: string) => {
    const updated = {
      ...authenticatedUsers,
      [role]: { username, fullName, email }
    };
    setAuthenticatedUsers(updated);
    localStorage.setItem("prefab_sessions", JSON.stringify(updated));
  };

  const handleLogout = (role: UserRole) => {
    const updated = {
      ...authenticatedUsers,
      [role]: null
    };
    setAuthenticatedUsers(updated);
    localStorage.setItem("prefab_sessions", JSON.stringify(updated));
  };

  // Mock Database States
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [manufacturers, setManufacturers] = useState<ManufacturerProfile[]>(INITIAL_MANUFACTURERS);
  const [quoteRequests, setQuoteRequests] = useState<QuoteRequest[]>(INITIAL_QUOTES);
  const [quotations, setQuotations] = useState<Quotation[]>(INITIAL_QUOTATIONS);
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [adminLogs, setAdminLogs] = useState<AdminLog[]>(INITIAL_ADMIN_LOGS);


  // User Interactive lists
  const [savedProductIds, setSavedProductIds] = useState<string[]>(["house_20_fold", "house_40_adu"]);
  const [compareProductIds, setCompareProductIds] = useState<string[]>([]);

  // Modals state
  const [selectedProductForDetail, setSelectedProductForDetail] = useState<Product | null>(null);
  const [isQuoteFormOpenOnModal, setIsQuoteFormOpenOnModal] = useState(false);

  // Browse Catalog Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [priceRange, setPriceRange] = useState<"All" | "under30" | "30to60" | "over60">("All");
  const [customizableOnly, setCustomizableOnly] = useState(false);
  const [offGridOnly, setOffGridOnly] = useState(false);
  const [aduOnly, setAduOnly] = useState(false);

  // Helper arrays for lookups
  const savedProducts = products.filter((p) => savedProductIds.includes(p.id));
  const compareProducts = products.filter((p) => compareProductIds.includes(p.id));

  const isZh = language === "zh";

  // ACTION HANDLERS

  // Save/Heart toggle
  const handleToggleSave = (productId: string) => {
    setSavedProductIds((prev) => {
      if (prev.includes(productId)) {
        return prev.filter((id) => id !== productId);
      } else {
        return [...prev, productId];
      }
    });
  };

  // Add/Remove from compare list (Max 4 limit)
  const handleToggleCompare = (product: Product) => {
    setCompareProductIds((prev) => {
      if (prev.includes(product.id)) {
        return prev.filter((id) => id !== product.id);
      } else {
        if (prev.length >= 4) {
          alert(isZh ? "最多只能同时对比4款模块化房型" : "You can compare up to 4 models side-by-side.");
          return prev;
        }
        return [...prev, product.id];
      }
    });
  };

  const handleRemoveCompare = (productId: string) => {
    setCompareProductIds((prev) => prev.filter((id) => id !== productId));
  };

  // Create a customized quote request from buyer
  const handleCreateQuoteRequest = (reqData: Omit<QuoteRequest, "id" | "date" | "status">) => {
    const newRequest: QuoteRequest = {
      ...reqData,
      id: `inq_${Date.now().toString().slice(-5)}`,
      status: "submitted",
      date: new Date().toLocaleDateString()
    };

    setQuoteRequests((prev) => [newRequest, ...prev]);

    // Append Admin Audit Log
    const newLog: AdminLog = {
      id: `log_${Date.now().toString().slice(-4)}`,
      timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
      action: "New Inquiry Created",
      details: `Buyer Mark Harrison submitted a customization request for ${reqData.productModel} to ${reqData.manufacturerName}.`
    };
    setAdminLogs((prev) => [newLog, ...prev]);

    // Go to buyer dashboard to show immediate feedback
    setCurrentView("dashboard");
  };

  // Create quotation from Manufacturer Portal
  const handleCreateQuotation = (quotationData: Omit<Quotation, "id" | "date">) => {
    const newQuotation: Quotation = {
      ...quotationData,
      id: `quo_${Date.now().toString().slice(-5)}`,
      date: new Date().toLocaleDateString()
    };

    setQuotations((prev) => [newQuotation, ...prev]);

    // Update QuoteRequest status to quotation_sent
    setQuoteRequests((prev) =>
      prev.map((r) => (r.id === quotationData.quoteRequestId ? { ...r, status: "quotation_sent" } : r))
    );

    // Audit log
    const newLog: AdminLog = {
      id: `log_${Date.now().toString().slice(-4)}`,
      timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
      action: "Quotation Sent",
      details: `Factory issued a formal quotation of $${quotationData.basePrice.toLocaleString()} for Inquiry #${quotationData.quoteRequestId}.`
    };
    setAdminLogs((prev) => [newLog, ...prev]);
  };

  // Update Quote request status directly (e.g. buyer pays deposit -> sets status to ordered)
  const handleUpdateQuoteStatus = (quoteId: string, status: QuoteRequest["status"]) => {
    setQuoteRequests((prev) =>
      prev.map((r) => (r.id === quoteId ? { ...r, status: status } : r))
    );

    // Audit log
    const newLog: AdminLog = {
      id: `log_${Date.now().toString().slice(-4)}`,
      timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
      action: status === "ordered" ? "Order Finalized" : "Inquiry Cancelled",
      details: status === "ordered" 
        ? `Buyer paid simulated 50% deposit for Inquiry #${quoteId}. Factory scheduling active.` 
        : `Inquiry #${quoteId} set to cancelled by buyer.`
    };
    setAdminLogs((prev) => [newLog, ...prev]);
  };

  // Add Product from Manufacturer Portal
  const handleAddProduct = (productData: Omit<Product, "id" | "manufacturerId" | "manufacturerName">) => {
    const newProduct: Product = {
      ...productData,
      id: `house_${Date.now().toString().slice(-5)}`,
      manufacturerId: "mfg_sz_tiny",
      manufacturerName: "Shenzhen Minimalist Tiny Home Tech"
    };

    setProducts((prev) => [newProduct, ...prev]);

    // Audit log
    const newLog: AdminLog = {
      id: `log_${Date.now().toString().slice(-4)}`,
      timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
      action: "Product Listing Appended",
      details: `Factory Shenzhen Tiny Home uploaded a new house listing model: ${productData.name}.`
    };
    setAdminLogs((prev) => [newLog, ...prev]);
  };

  // Admin approves/rejects factory profiles
  const handleApproveManufacturer = (mfgId: string) => {
    setManufacturers((prev) =>
      prev.map((m) => (m.id === mfgId ? { ...m, status: "approved" } : m))
    );

    const mfgName = manufacturers.find((m) => m.id === mfgId)?.companyName || mfgId;
    const newLog: AdminLog = {
      id: `log_${Date.now().toString().slice(-4)}`,
      timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
      action: "Manufacturer Approved",
      details: `Administrator reviewed credentials and APPROVED export qualifications for ${mfgName}.`
    };
    setAdminLogs((prev) => [newLog, ...prev]);
  };

  const handleRejectManufacturer = (mfgId: string) => {
    setManufacturers((prev) =>
      prev.map((m) => (m.id === mfgId ? { ...m, status: "suspended" } : m))
    );

    const mfgName = manufacturers.find((m) => m.id === mfgId)?.companyName || mfgId;
    const newLog: AdminLog = {
      id: `log_${Date.now().toString().slice(-4)}`,
      timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
      action: "Manufacturer Disapproved",
      details: `Administrator REJECTED license upload credentials for ${mfgName}.`
    };
    setAdminLogs((prev) => [newLog, ...prev]);
  };

  // Send Messages in Chat panels
  const handleSendMessage = (text: string, toId: string) => {
    const newMsg: Message = {
      id: `msg_${Date.now()}`,
      fromId: currentRole === "buyer" ? "buyer_mark" : "mfg_sz_tiny",
      fromName: currentRole === "buyer" ? "Mark Harrison" : "Shenzhen Tiny Home Tech",
      toId: toId,
      toName: toId === "buyer_mark" ? "Mark Harrison" : "Shenzhen Tiny Home Tech",
      text: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, newMsg]);
  };

  // Reset Filters
  const handleResetFilters = () => {
    setSearchQuery("");
    setSelectedCategory("All");
    setPriceRange("All");
    setCustomizableOnly(false);
    setOffGridOnly(false);
    setAduOnly(false);
  };

  // FILTERED CATALOG RESULTS
  const filteredProducts = products.filter((product) => {
    // Search keyword
    const matchSearch =
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.description.toLowerCase().includes(searchQuery.toLowerCase());

    // Category Selector
    const matchCategory = selectedCategory === "All" || product.category === selectedCategory;

    // Price range selector
    let matchPrice = true;
    if (priceRange === "under30") matchPrice = product.price < 30000;
    else if (priceRange === "30to60") matchPrice = product.price >= 30000 && product.price <= 60000;
    else if (priceRange === "over60") matchPrice = product.price > 60000;

    // Toggles
    const matchCustom = !customizableOnly || product.isCustomizable;
    const matchOffGrid = !offGridOnly || product.isSuitableForOffGrid;
    const matchAdu = !aduOnly || product.isSuitableForAdu;

    return matchSearch && matchCategory && matchPrice && matchCustom && matchOffGrid && matchAdu;
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-800 font-sans selection:bg-amber-100 selection:text-slate-900">
      
      {/* GLOBAL HEADER */}
      <Header
        language={language}
        setLanguage={setLanguage}
        activeRole={currentRole}
        setActiveRole={setCurrentRole}
        savedCount={savedProductIds.length}
        compareCount={compareProductIds.length}
        unreadCount={4}
        currentView={currentView === "advisor" ? "ai-advisor" : currentView}
        setCurrentView={(view) => setCurrentView(view === "ai-advisor" ? "advisor" : view as any)}
        authenticatedUser={authenticatedUsers[currentRole]}
        onLogout={() => handleLogout(currentRole)}
      />

      {/* BODY CONTENT ROUTER */}
      <main className="flex-1 pb-16">
        
        {/* VIEW 1: BROWSE CATALOG */}
        {currentView === "browse" && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
            
            {/* Immersive Hero Header */}
            <div className="relative rounded-3xl overflow-hidden bg-slate-900 text-white p-8 sm:p-12 shadow-md border border-slate-800">
              {/* Background gradient highlights */}
              <div className="absolute inset-0 bg-linear-to-tr from-slate-950 via-slate-900 to-amber-950/40 opacity-90 z-0" />
              
              <div className="relative z-10 max-w-2xl space-y-4">
                <span className="bg-amber-400 text-slate-950 font-black text-[10px] tracking-widest uppercase px-2.5 py-0.5 rounded-md inline-block">
                  Direct Cross-Border Marketplace
                </span>
                <h1 className="font-sans font-black text-3xl sm:text-5xl tracking-tight leading-tight">
                  {isZh ? "中国源头集成房屋直供平台" : "Buy Chinese Prefab Modular Homes Directly"}
                </h1>
                <p className="text-sm text-slate-300 leading-relaxed max-w-lg">
                  {isZh 
                    ? "连接美国个人买家与中国顶尖精工制造厂。支持全流程英文技术建规核算，提供集装箱海运及目的港清关吊装估价。" 
                    : "Connecting US homeowners with leading ISO-verified factories in China. Access technical specifications, container log estimators, and real-time translation chats."}
                </p>
                
                {/* Search bar inside hero */}
                <div className="pt-2 flex flex-col sm:flex-row items-stretch space-y-2 sm:space-y-0 sm:space-x-2 max-w-md">
                  <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={getTranslation(language, "searchPlaceholder")}
                      className="w-full bg-white/10 text-white placeholder-slate-400 rounded-xl pl-10 pr-4 py-3 text-xs outline-hidden focus:ring-1 focus:ring-amber-400 border border-white/10 focus:border-amber-400"
                    />
                  </div>
                  <button
                    onClick={() => setCurrentView("advisor")}
                    className="bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold text-xs px-5 py-3 rounded-xl flex items-center justify-center space-x-1.5 transition-colors shrink-0"
                  >
                    <Bot className="w-4 h-4" />
                    <span>{isZh ? "智能建规顾问" : "AI Zoning Assistant"}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Catalog Grid Section */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
              
              {/* Sidebar Filters */}
              <div className="bg-white border border-slate-100 p-6 rounded-3xl shadow-3xs space-y-6 lg:sticky lg:top-24">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <div className="flex items-center space-x-1.5 text-slate-900">
                    <SlidersHorizontal className="w-4 h-4 text-amber-500" />
                    <h3 className="font-sans font-bold text-xs uppercase tracking-wide">{getTranslation(language, "filterTitle")}</h3>
                  </div>
                  <button
                    onClick={handleResetFilters}
                    className="text-slate-400 hover:text-slate-900 text-[10px] font-bold flex items-center space-x-1"
                    title="Reset all filters"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>{isZh ? "重置" : "Reset"}</span>
                  </button>
                </div>

                {/* Categories */}
                <div className="space-y-2">
                  <span className="block font-bold text-slate-400 text-[10px] uppercase tracking-wider">{getTranslation(language, "category")}</span>
                  <div className="flex flex-col space-y-1 text-xs">
                    {["All", "Tiny House", "ADU", "Modular House", "Container House"].map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`text-left px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                          selectedCategory === cat 
                            ? "bg-slate-900 text-white" 
                            : "text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {cat === "All" ? (isZh ? "全部类型" : "All Products") : cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Price range */}
                <div className="space-y-2">
                  <span className="block font-bold text-slate-400 text-[10px] uppercase tracking-wider">{getTranslation(language, "priceFilter")}</span>
                  <div className="flex flex-col space-y-1 text-xs">
                    {[
                      { key: "All", label: isZh ? "不限价格" : "Any Price" },
                      { key: "under30", label: isZh ? "3万美元以下" : "Under $30k" },
                      { key: "30to60", label: isZh ? "$30k - $60k" : "$30,000 - $60,000" },
                      { key: "over60", label: isZh ? "6万美元以上" : "Over $60k" }
                    ].map((opt) => (
                      <button
                        key={opt.key}
                        onClick={() => setPriceRange(opt.key as any)}
                        className={`text-left px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                          priceRange === opt.key 
                            ? "bg-slate-900 text-white" 
                            : "text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quick Toggle Checkboxes */}
                <div className="space-y-3 pt-3 border-t border-slate-100 text-xs">
                  <label className="flex items-center space-x-2 text-slate-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={customizableOnly}
                      onChange={(e) => setCustomizableOnly(e.target.checked)}
                      className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                    />
                    <span>{isZh ? "仅看支持全屋定制" : "Customizable Only"}</span>
                  </label>

                  <label className="flex items-center space-x-2 text-slate-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={offGridOnly}
                      onChange={(e) => setOffGridOnly(e.target.checked)}
                      className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                    />
                    <span>{isZh ? "仅看适配离网系统" : "Off-grid Compatible"}</span>
                  </label>

                  <label className="flex items-center space-x-2 text-slate-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={aduOnly}
                      onChange={(e) => setAduOnly(e.target.checked)}
                      className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                    />
                    <span>{isZh ? "符合后院小屋建规 (ADU)" : "ADU Compliant models"}</span>
                  </label>
                </div>
              </div>

              {/* Product Listing Grid */}
              <div className="lg:col-span-3 space-y-6">
                
                {/* Search result and Compare sticky helper */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-4 border border-slate-100 rounded-2xl shadow-3xs text-xs">
                  <span className="text-slate-500">
                    {isZh ? "找到" : "Showing"} <strong className="text-slate-900 font-bold">{filteredProducts.length}</strong> {isZh ? "款符合条件的优质房型" : "matching premium prefab models"}
                  </span>

                  {compareProductIds.length > 0 && (
                    <div className="mt-2 sm:mt-0 flex items-center space-x-3 bg-amber-50 border border-amber-200 px-3.5 py-1.5 rounded-xl">
                      <span className="text-amber-800 font-bold text-[10px]">
                        {isZh ? `已添加 ${compareProductIds.length} 款模型` : `${compareProductIds.length} models selected`}
                      </span>
                      <button
                        onClick={() => setCurrentView("compare")}
                        className="bg-amber-400 hover:bg-amber-500 text-slate-950 px-2.5 py-1 rounded-lg font-black text-[10px] tracking-wide uppercase flex items-center space-x-1"
                      >
                        <ArrowLeftRight className="w-3 h-3" />
                        <span>{isZh ? "立即对比" : "Compare Now"}</span>
                      </button>
                    </div>
                  )}
                </div>

                {filteredProducts.length === 0 ? (
                  <div className="bg-white border border-slate-100 rounded-3xl p-16 text-center space-y-4">
                    <SlidersHorizontal className="w-12 h-12 text-slate-200 mx-auto" />
                    <div>
                      <h4 className="font-sans font-bold text-slate-800 text-sm">{isZh ? "未找到符合条件的房型" : "No models match your filters"}</h4>
                      <p className="text-xs text-slate-400 mt-1">{isZh ? "请尝试放宽价格区间或选择其他房屋类型。" : "Try adjusting your budget limits or changing options."}</p>
                    </div>
                    <button
                      onClick={handleResetFilters}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs"
                    >
                      {isZh ? "清空所有筛选" : "Reset Filters"}
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredProducts.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        language={language}
                        isSaved={savedProductIds.includes(product.id)}
                        isComparing={compareProductIds.includes(product.id)}
                        onToggleSave={handleToggleSave}
                        onToggleCompare={handleToggleCompare}
                        onViewDetails={setSelectedProductForDetail}
                        onOpenQuoteRequest={(p) => {
                          setSelectedProductForDetail(p);
                          setIsQuoteFormOpenOnModal(true);
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>

            </div>

          </div>
        )}

        {/* VIEW 2: PRODUCT COMPARISON GRID */}
        {currentView === "compare" && (
          <ProductComparison
            compareList={compareProducts}
            language={language}
            onRemoveFromCompare={handleRemoveCompare}
            onViewDetails={(p) => setSelectedProductForDetail(p)}
            onOpenQuoteRequest={(p) => {
              setSelectedProductForDetail(p);
              setIsQuoteFormOpenOnModal(true);
            }}
          />
        )}

        {/* VIEW 3: AI ASSISTANT CHAT */}
        {currentView === "advisor" && (
          <AIAdvisor language={language} />
        )}

        {/* VIEW 3.5: IMPORT & CUSTOMS CENTER */}
        {currentView === "import-center" && (
          <ImportCustomsCenter 
            language={language}
            products={products}
          />
        )}

        {/* VIEW 4: ROLE PORTAL DASHBOARDS */}
        {currentView === "dashboard" && (
          <>
            {!authenticatedUsers[currentRole] ? (
              <AuthPortal
                language={language}
                role={currentRole}
                onLoginSuccess={(username, fullName, email) => handleLoginSuccess(currentRole, username, fullName, email)}
              />
            ) : (
              <>
                {currentRole === "buyer" && (
                  <BuyerDashboard
                    language={language}
                    savedProducts={savedProducts}
                    onRemoveSave={handleToggleSave}
                    onViewProduct={(p) => setSelectedProductForDetail(p)}
                    quoteRequests={quoteRequests}
                    quotations={quotations}
                    messages={messages}
                    onSendMessage={handleSendMessage}
                    onUpdateQuoteStatus={handleUpdateQuoteStatus}
                  />
                )}

                {currentRole === "manufacturer" && (
                  <ManufacturerDashboard
                    language={language}
                    products={products}
                    quoteRequests={quoteRequests}
                    onAddProduct={handleAddProduct}
                    onCreateQuotation={handleCreateQuotation}
                    messages={messages}
                    onSendMessage={handleSendMessage}
                  />
                )}

                {currentRole === "admin" && (
                  <AdminDashboard
                    language={language}
                    manufacturers={manufacturers}
                    products={products}
                    adminLogs={adminLogs}
                    onApproveManufacturer={handleApproveManufacturer}
                    onRejectManufacturer={handleRejectManufacturer}
                    onUpdateManufacturers={setManufacturers}
                    onUpdateProducts={setProducts}
                    onAddAdminLog={(action, details) => {
                      const newLog = {
                        id: `log_${Date.now()}`,
                        timestamp: new Date().toISOString().replace("T", " ").slice(0, 19),
                        action,
                        details
                      };
                      setAdminLogs(prev => [newLog, ...prev]);
                    }}
                  />
                )}
              </>
            )}
          </>
        )}

      </main>

      {/* TECH COMPLIANCE GLOBAL FOOTER BANNER */}
      <footer className="bg-slate-900 border-t border-slate-800 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-3 gap-8 text-xs text-slate-400">
          <div className="space-y-3">
            <span className="font-sans font-black text-white text-sm tracking-tight flex items-center space-x-1.5">
              <span>PrefabHome Marketplace</span>
            </span>
            <p className="leading-relaxed">
              {isZh 
                ? "中美首个装配式与集成住宅智能化跨境直连、技术合规核对与双语沟通平台。" 
                : "The leading global portal connecting certified Chinese fabrication factories with individual buyers in the United States."}
            </p>
          </div>
          
          <div className="space-y-2">
            <strong className="text-white block font-bold uppercase">{isZh ? "技术标准合规审核" : "Technical Compliance Standard"}</strong>
            <p className="leading-relaxed">
              {isZh 
                ? "所有产品电路线路强制执行 US NEC 标准；排水系统执行 US UPC 规范。结构轻钢执行 CE 及美标 ASTM 标准。" 
                : "Standard electrical wiring certified for US NEC compliance. PEX plumbing elements manufactured according to US UPC standards."}
            </p>
          </div>

          <div className="space-y-2">
            <strong className="text-white block font-bold uppercase">{isZh ? "法律与责任申明" : "Legal Notice Disclaimer"}</strong>
            <p className="leading-relaxed">
              {isZh 
                ? "本平台不构成注册工程建商或物流代理。所有买家须核对各州对 ADU 或主要住宅的后院红线退让、基础工程建规。" 
                : "Platform is not a general building contractor. Buyers must individually verify local county foundation requirements, ADU setback restrictions, and permit regulations."}
            </p>
          </div>
        </div>
      </footer>

      {/* DETAILED SPECIFICATIONS MODAL (with Quote request form) */}
      {selectedProductForDetail && (
        <ProductDetailModal
          product={selectedProductForDetail}
          language={language}
          onClose={() => {
            setSelectedProductForDetail(null);
            setIsQuoteFormOpenOnModal(false);
          }}
          onToggleSave={handleToggleSave}
          isSaved={savedProductIds.includes(selectedProductForDetail.id)}
          onSubmitQuote={handleCreateQuoteRequest}
          startWithQuoteFormOpen={isQuoteFormOpenOnModal}
        />
      )}

    </div>
  );
}
