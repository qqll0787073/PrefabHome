import React, { useState, useEffect } from "react";
import { Product, Language, QuoteRequest } from "../types";
import { getTranslation } from "../utils/translation";
import { getChineseCategoryName } from "./ProductCard";
import { X, Play, ShieldAlert, FileText, Info, Anchor, Truck, Settings, HelpCircle, FileCheck, CheckCircle } from "lucide-react";

interface ProductDetailModalProps {
  product: Product;
  language: Language;
  onClose: () => void;
  onToggleSave: (productId: string) => void;
  isSaved: boolean;
  onOpenQuoteForm?: () => void;
  onSubmitQuote: (quote: Omit<QuoteRequest, "id" | "date" | "status">) => void;
  startWithQuoteFormOpen?: boolean;
}

const PORT_OPTIONS = [
  { state: "CA", port: "Port of Los Angeles / Long Beach", oceanCost: 4200, taxRate: 0.05, truckingBase: 600 },
  { state: "TX", port: "Port of Houston", oceanCost: 5500, taxRate: 0.045, truckingBase: 800 },
  { state: "FL", port: "Port of Miami", oceanCost: 5900, taxRate: 0.045, truckingBase: 900 },
  { state: "NY", port: "Port of New York / New Jersey", oceanCost: 6100, taxRate: 0.06, truckingBase: 700 },
  { state: "WA", port: "Port of Seattle", oceanCost: 4500, taxRate: 0.05, truckingBase: 500 },
];

export default function ProductDetailModal({
  product,
  language,
  onClose,
  onToggleSave,
  isSaved,
  onOpenQuoteForm,
  onSubmitQuote,
  startWithQuoteFormOpen = false
}: ProductDetailModalProps) {
  const isZh = language === "zh";
  const [activeTab, setActiveTab] = useState<"overview" | "specs" | "shipping" | "quote">(
    startWithQuoteFormOpen ? "quote" : "overview"
  );
  const [selectedGalleryIdx, setSelectedGalleryIdx] = useState(0);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  // Dynamic Shipping calculation state
  const [selectedState, setSelectedState] = useState("CA");
  const [zipCode, setZipCode] = useState("90001");
  const [needInstallation, setNeedInstallation] = useState(true);
  const [craneHired, setCraneHired] = useState(true);

  // Quote form state
  const [quoteForm, setQuoteForm] = useState({
    buyerName: "Mark Harrison",
    buyerEmail: "m.harrison@gmail.com",
    buyerPhone: "+1 (512) 555-0144",
    quantity: 1,
    budget: product.price + 15000,
    projectLocation: "Los Angeles, CA",
    landStatus: "owned" as "owned" | "searching",
    needInstallationSupport: true,
    needFinancing: false,
    needPermitAssistance: true,
    customizationRequest: "",
    uploadedFiles: [] as string[]
  });
  const [quoteSuccessMsg, setQuoteSuccessMsg] = useState(false);

  // Sync activeTab if startWithQuoteFormOpen changes
  useEffect(() => {
    if (startWithQuoteFormOpen) {
      setActiveTab("quote");
    }
  }, [startWithQuoteFormOpen]);

  // Auto-fill form location based on selected state
  useEffect(() => {
    const statesMap: Record<string, string> = {
      CA: "Los Angeles, CA",
      TX: "Houston, TX",
      FL: "Miami, FL",
      NY: "Brooklyn, NY",
      WA: "Seattle, WA"
    };
    const zipsMap: Record<string, string> = {
      CA: "90001",
      TX: "77001",
      FL: "33101",
      NY: "11201",
      WA: "98101"
    };
    setQuoteForm(prev => ({
      ...prev,
      projectLocation: statesMap[selectedState] || "Los Angeles, CA",
      zipCode: zipsMap[selectedState] || "90001"
    }));
    setZipCode(zipsMap[selectedState] || "90001");
  }, [selectedState]);

  // Calculate Landed Cost
  const activePortConfig = PORT_OPTIONS.find(p => p.state === selectedState) || PORT_OPTIONS[0];
  const factoryPrice = product.price * quoteForm.quantity;
  const oceanFreight = activePortConfig.oceanCost * quoteForm.quantity;
  const importDuty = factoryPrice * 0.12; // 12% average tariff
  const portFee = 450 * quoteForm.quantity;
  const customsClearance = 350;
  const inlandTrucking = activePortConfig.truckingBase + 250; // flat rate for mock
  const craneCost = craneHired ? 1200 : 0;
  const installationEstimate = needInstallation ? (product.category === "Steel Villa" ? 15000 : 4500) : 0;
  const totalLandedCost = factoryPrice + oceanFreight + importDuty + portFee + customsClearance + inlandTrucking + craneCost + installationEstimate;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArr = Array.from(e.target.files as FileList).map((f: File) => f.name);
      setQuoteForm(prev => ({ ...prev, uploadedFiles: [...prev.uploadedFiles, ...filesArr] }));
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmitQuote({
      buyerName: quoteForm.buyerName,
      buyerEmail: quoteForm.buyerEmail,
      buyerPhone: quoteForm.buyerPhone,
      productId: product.id,
      productModel: product.name,
      manufacturerId: product.manufacturerId,
      manufacturerName: product.manufacturerName,
      quantity: quoteForm.quantity,
      budget: quoteForm.budget,
      projectLocation: quoteForm.projectLocation,
      zipCode: zipCode,
      landStatus: quoteForm.landStatus,
      needInstallationSupport: quoteForm.needInstallationSupport,
      needFinancing: quoteForm.needFinancing,
      needPermitAssistance: quoteForm.needPermitAssistance,
      customizationRequest: quoteForm.customizationRequest,
      uploadedFiles: quoteForm.uploadedFiles
    });
    setQuoteSuccessMsg(true);
    setTimeout(() => {
      setQuoteSuccessMsg(false);
      setActiveTab("overview");
    }, 4000);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-50 flex justify-center items-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header bar */}
        <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center">
          <div>
            <span className="text-[10px] font-bold tracking-wider uppercase bg-amber-500 text-slate-950 px-2.5 py-0.5 rounded-md mb-1 inline-block">
              {product.modelNumber}
            </span>
            <h2 className="font-sans font-extrabold text-xl leading-none">{product.name}</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 transition-colors text-slate-300 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-100 bg-slate-50 overflow-x-auto">
          {(["overview", "specs", "shipping", "quote"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-4 text-sm font-bold border-b-2 whitespace-nowrap transition-all ${
                activeTab === tab
                  ? "border-slate-900 text-slate-900 bg-white"
                  : "border-transparent text-slate-500 hover:text-slate-900"
              }`}
            >
              {tab === "overview" && (isZh ? "产品概览" : "Overview")}
              {tab === "specs" && (isZh ? "详细技术参数" : "Technical Specs")}
              {tab === "shipping" && (isZh ? "到岸价估算器" : "Landed Cost Estimator")}
              {tab === "quote" && (isZh ? "向厂家申请报价" : "Request Official Quote")}
            </button>
          ))}
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto flex-1 bg-white">
          
          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
              
              {/* Left Column: Visual Assets */}
              <div className="md:col-span-6 space-y-4">
                <div className="relative aspect-video rounded-2xl overflow-hidden bg-slate-100 group shadow-sm">
                  {isVideoPlaying && product.videoUrl ? (
                    <video
                      src={product.videoUrl}
                      controls
                      autoPlay
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <>
                      <img
                        src={product.imageGallery[selectedGalleryIdx] || product.image}
                        alt={product.name}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      {product.videoUrl && (
                        <button
                          onClick={() => setIsVideoPlaying(true)}
                          className="absolute inset-0 flex items-center justify-center bg-slate-900/30 hover:bg-slate-900/40 transition-colors"
                        >
                          <span className="w-14 h-14 rounded-full bg-white text-slate-900 flex items-center justify-center shadow-lg hover:scale-110 transition-transform">
                            <Play className="w-6 h-6 fill-current ml-1" />
                          </span>
                        </button>
                      )}
                    </>
                  )}
                </div>

                {/* Gallery Select */}
                <div className="flex space-x-2 overflow-x-auto">
                  {product.imageGallery.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setSelectedGalleryIdx(idx);
                        setIsVideoPlaying(false);
                      }}
                      className={`w-20 aspect-video rounded-lg overflow-hidden border-2 transition-all ${
                        selectedGalleryIdx === idx && !isVideoPlaying ? "border-amber-500" : "border-transparent"
                      }`}
                    >
                      <img src={img} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </button>
                  ))}
                  {product.videoUrl && (
                    <button
                      onClick={() => setIsVideoPlaying(true)}
                      className={`w-20 aspect-video rounded-lg bg-slate-900 text-white flex items-center justify-center border-2 text-[10px] font-bold ${
                        isVideoPlaying ? "border-amber-500" : "border-transparent"
                      }`}
                    >
                      VIDEO
                    </button>
                  )}
                </div>

                {/* Highlights boxes */}
                <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                  <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-3">
                    {isZh ? "产品核心卖点" : "Key Model Merits"}
                  </h4>
                  <ul className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                    <li className="flex items-center space-x-1.5">
                      <span className="text-emerald-500">✓</span>
                      <span>{isZh ? "精钢防腐龙骨" : "Anti-Corrosion Framing"}</span>
                    </li>
                    <li className="flex items-center space-x-1.5">
                      <span className="text-emerald-500">✓</span>
                      <span>{isZh ? "断桥铝合金Low-E玻璃" : "Low-E Thermal Windows"}</span>
                    </li>
                    <li className="flex items-center space-x-1.5">
                      <span className="text-emerald-500">✓</span>
                      <span>{isZh ? "美标布线(NEC)认证" : "US Standard Electrical"}</span>
                    </li>
                    <li className="flex items-center space-x-1.5">
                      <span className="text-emerald-500">✓</span>
                      <span>{isZh ? "环保无味墙体装饰" : "Eco-friendly Subfloors"}</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Right Column: Descriptions & Actions */}
              <div className="md:col-span-6 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-400 block mb-1">
                    {getTranslation(language, "category")}: {isZh ? getChineseCategoryName(product.category) : product.category}
                  </span>
                  <h3 className="font-sans font-black text-slate-950 text-2xl mb-4">
                    {product.name}
                  </h3>
                  
                  {/* Manufacturer Card */}
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
                    <div>
                      <span className="text-xs text-slate-400 block">{isZh ? "制造工厂" : "Manufacturer"}</span>
                      <strong className="text-sm text-slate-800">{product.manufacturerName}</strong>
                    </div>
                  </div>

                  {/* Description text */}
                  <div className="text-sm text-slate-600 leading-relaxed mb-6">
                    <p className="font-medium mb-2 text-slate-800">{isZh ? "产品描述" : "About this home"}:</p>
                    <p>{product.description}</p>
                  </div>

                  {/* Floor plan summary */}
                  <div className="border border-slate-100 rounded-2xl p-4 bg-amber-50/50 mb-6">
                    <h5 className="text-xs font-bold text-amber-800 uppercase tracking-wide mb-1 flex items-center space-x-1">
                      <FileText className="w-3.5 h-3.5" />
                      <span>{getTranslation(language, "floorPlan")}</span>
                    </h5>
                    <p className="text-xs text-slate-600 leading-relaxed">{product.floorPlan}</p>
                  </div>
                </div>

                {/* FOB Pricing and Buttons */}
                <div className="border-t border-slate-100 pt-6">
                  <div className="flex justify-between items-baseline mb-4">
                    <span className="text-sm text-slate-500 font-bold">{getTranslation(language, "fobPrice")}</span>
                    <div className="text-right">
                      <span className="text-3xl font-black text-slate-900">${product.price.toLocaleString()}</span>
                      <span className="text-xs text-slate-400 font-medium block">FOB {isZh ? "中国深圳/宁波港交货" : "Port of Shenzhen/Ningbo, China"}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
                      onClick={() => onToggleSave(product.id)}
                      className={`py-3.5 rounded-2xl font-bold flex items-center justify-center space-x-1.5 transition-all text-sm border ${
                        isSaved
                          ? "bg-rose-500 text-white border-rose-500"
                          : "border-slate-200 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <span>{isSaved ? "★" : "☆"}</span>
                      <span>{isSaved ? getTranslation(language, "saved") : getTranslation(language, "save")}</span>
                    </button>
                    
                    <button
                      onClick={() => setActiveTab("shipping")}
                      className="py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold transition-colors text-sm text-center"
                    >
                      {isZh ? "估算落地总价" : "Estimate Landed Cost"}
                    </button>

                    <button
                      onClick={() => setActiveTab("quote")}
                      className="py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold transition-colors text-sm text-center"
                    >
                      {getTranslation(language, "requestQuote")}
                    </button>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* TAB 2: TECHNICAL SPECIFICATIONS */}
          {activeTab === "specs" && (
            <div className="space-y-6">
              <h4 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3">
                {getTranslation(language, "specifications")}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                
                {/* Structural Section */}
                <div className="space-y-4">
                  <h5 className="font-bold text-amber-700 text-xs uppercase tracking-wider">{isZh ? "1. 墙板与主体框架" : "1. Structural Frame & Walls"}</h5>
                  <div className="border border-slate-100 rounded-2xl overflow-hidden divide-y divide-slate-50 text-xs">
                    <div className="grid grid-cols-3 p-3.5">
                      <span className="text-slate-400 font-medium">{getTranslation(language, "structure")}</span>
                      <span className="col-span-2 text-slate-800 font-semibold">{product.structureMaterial}</span>
                    </div>
                    <div className="grid grid-cols-3 p-3.5">
                      <span className="text-slate-400 font-medium">{getTranslation(language, "wall")}</span>
                      <span className="col-span-2 text-slate-800 font-semibold">{product.wallMaterial}</span>
                    </div>
                    <div className="grid grid-cols-3 p-3.5">
                      <span className="text-slate-400 font-medium">{getTranslation(language, "roof")}</span>
                      <span className="col-span-2 text-slate-800 font-semibold">{product.roofMaterial}</span>
                    </div>
                    <div className="grid grid-cols-3 p-3.5">
                      <span className="text-slate-400 font-medium">{getTranslation(language, "insulation")}</span>
                      <span className="col-span-2 text-slate-800 font-semibold">{product.insulation}</span>
                    </div>
                  </div>
                </div>

                {/* Systems Section */}
                <div className="space-y-4">
                  <h5 className="font-bold text-amber-700 text-xs uppercase tracking-wider">{isZh ? "2. 水电给排水系统" : "2. Plumbing & Electrical Standards"}</h5>
                  <div className="border border-slate-100 rounded-2xl overflow-hidden divide-y divide-slate-50 text-xs">
                    <div className="grid grid-cols-3 p-3.5">
                      <span className="text-slate-400 font-medium">{getTranslation(language, "electrical")}</span>
                      <span className="col-span-2 text-slate-800 font-semibold">
                        {product.electricalSystem} <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded text-[10px] font-bold">符合美标 NEC</span>
                      </span>
                    </div>
                    <div className="grid grid-cols-3 p-3.5">
                      <span className="text-slate-400 font-medium">{getTranslation(language, "plumbing")}</span>
                      <span className="col-span-2 text-slate-800 font-semibold">
                        {product.plumbingSystem} <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded text-[10px] font-bold">符合美标 UPC</span>
                      </span>
                    </div>
                    <div className="grid grid-cols-3 p-3.5">
                      <span className="text-slate-400 font-medium">{getTranslation(language, "window")}</span>
                      <span className="col-span-2 text-slate-800 font-semibold">{product.windowType}</span>
                    </div>
                    <div className="grid grid-cols-3 p-3.5">
                      <span className="text-slate-400 font-medium">{isZh ? "有无厨房" : "Kitchen Module"}</span>
                      <span className="col-span-2 text-slate-800 font-semibold">{product.hasKitchen ? (isZh ? "含集成厨房橱柜" : "Includes modular kitchen cabinets") : (isZh ? "不含 (需定制)" : "None")}</span>
                    </div>
                  </div>
                </div>

                {/* Logistics Section */}
                <div className="space-y-4">
                  <h5 className="font-bold text-amber-700 text-xs uppercase tracking-wider">{isZh ? "3. 物理规格与集装箱" : "3. Physical Dimensions & Logistical Spec"}</h5>
                  <div className="border border-slate-100 rounded-2xl overflow-hidden divide-y divide-slate-50 text-xs">
                    <div className="grid grid-cols-3 p-3.5">
                      <span className="text-slate-400 font-medium">{getTranslation(language, "size")}</span>
                      <span className="col-span-2 text-slate-800 font-semibold">{product.size}</span>
                    </div>
                    <div className="grid grid-cols-3 p-3.5">
                      <span className="text-slate-400 font-medium">{getTranslation(language, "weight")}</span>
                      <span className="col-span-2 text-slate-800 font-semibold">{product.weight.toLocaleString()} kg</span>
                    </div>
                    <div className="grid grid-cols-3 p-3.5">
                      <span className="text-slate-400 font-medium">{getTranslation(language, "requiredContainer")}</span>
                      <span className="col-span-2 text-slate-800 font-semibold text-amber-600 font-bold">{product.requiredContainers}</span>
                    </div>
                  </div>
                </div>

                {/* Compliance Section */}
                <div className="space-y-4">
                  <h5 className="font-bold text-amber-700 text-xs uppercase tracking-wider">{isZh ? "4. 质保与海外认证" : "4. Warranty & Global Certifications"}</h5>
                  <div className="border border-slate-100 rounded-2xl overflow-hidden divide-y divide-slate-50 text-xs">
                    <div className="grid grid-cols-3 p-3.5">
                      <span className="text-slate-400 font-medium">{getTranslation(language, "warranty")}</span>
                      <span className="col-span-2 text-slate-800 font-semibold">{product.warranty}</span>
                    </div>
                    <div className="grid grid-cols-3 p-3.5">
                      <span className="text-slate-400 font-medium">{getTranslation(language, "certifications")}</span>
                      <div className="col-span-2 flex flex-wrap gap-1">
                        {product.certifications.map((cert, idx) => (
                          <span key={idx} className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-bold border border-slate-200">
                            {cert}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

              </div>
              
              {/* Compliance advisory */}
              <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200 flex items-start space-x-3 text-xs text-amber-800">
                <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
                <div>
                  <h6 className="font-bold mb-1">{isZh ? "美国本地建规(Building Codes)特别提示" : "US Local Building Codes Compliancy"}</h6>
                  <p className="leading-relaxed">
                    {isZh 
                      ? "本型号产品配套的配电盒、空开及给排水管件均选用通过美国 UL、CSA 或 UPC 认证的配件。但请注意，美国各州各县对后院 ADU 以及模块房屋的防风、抗震等级（例如加州 Title 24、佛州飓风防护风荷载）以及地基锚固有着特殊的工程要求，请务必在采购前将产品的工程图提交给您当地的郡县建规审查办(Zoning Department)先行预审。"
                      : "Plumbing, switches, and conduits meet UL and UPC standards for easy passing of local US plumbing/electrical inspections. However, structural certifications (e.g. California Title 24, high wind zone ratings in Florida, seismic bolting) require regional engineering review. Consult your local Building Department first."}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: LANDED COST & SHIPPING ESTIMATOR */}
          {activeTab === "shipping" && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-100 pb-4">
                <div>
                  <h4 className="text-lg font-bold text-slate-900">{getTranslation(language, "shippingEstimatorTitle")}</h4>
                  <p className="text-xs text-slate-500">{isZh ? "动态模拟出厂到美国家门口的闭环物流与组装费用" : "Simulate total ocean transit, customs duties, inland delivery, and assembly fees"}</p>
                </div>
                
                {/* State selector */}
                <div className="flex space-x-3 mt-4 md:mt-0">
                  <label className="text-xs font-bold text-slate-600 flex items-center">
                    {isZh ? "目的地州" : "Destination State"}:
                  </label>
                  <select
                    value={selectedState}
                    onChange={(e) => setSelectedState(e.target.value)}
                    className="border border-slate-200 rounded-lg p-1.5 text-xs font-semibold text-slate-800 bg-slate-50 outline-hidden"
                  >
                    {PORT_OPTIONS.map((opt) => (
                      <option key={opt.state} value={opt.state}>
                        {opt.state} ({opt.state === "CA" ? "California" : opt.state === "TX" ? "Texas" : opt.state === "FL" ? "Florida" : opt.state === "NY" ? "New York" : "Washington"})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                
                {/* Inputs & Parameters */}
                <div className="md:col-span-5 bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-4">
                  <h5 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-2">{isZh ? "测算参数设置" : "Simulation Controls"}</h5>
                  
                  <div className="space-y-3.5 text-xs text-slate-700">
                    <div>
                      <label className="block font-semibold mb-1">{getTranslation(language, "deliveryZip")}</label>
                      <input
                        type="text"
                        value={zipCode}
                        onChange={(e) => setZipCode(e.target.value)}
                        className="w-full border border-slate-200 rounded-lg p-2 bg-white"
                      />
                    </div>

                    <div className="p-3 bg-white rounded-xl border border-slate-200/50">
                      <label className="flex items-center space-x-2 font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={needInstallation}
                          onChange={(e) => setNeedInstallation(e.target.checked)}
                          className="rounded text-slate-900 focus:ring-slate-900"
                        />
                        <span>{getTranslation(language, "needInstallation")}</span>
                      </label>
                      <p className="text-[10px] text-slate-400 mt-1 ml-5">
                        {isZh ? "中国工厂派发视频辅导或聘请中方持牌人员远程连线协助组装" : "Includes remote structural alignment help & electrical wiring advisory"}
                      </p>
                    </div>

                    <div className="p-3 bg-white rounded-xl border border-slate-200/50">
                      <label className="flex items-center space-x-2 font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={craneHired}
                          onChange={(e) => setCraneHired(e.target.checked)}
                          className="rounded text-slate-900 focus:ring-slate-900"
                        />
                        <span>{isZh ? "包含现场吊车(Crane)和就位调试费" : "Include local mobile crane hiring (estimate)"}</span>
                      </label>
                      <p className="text-[10px] text-slate-400 mt-1 ml-5">
                        {isZh ? "大宗模块卸货就位必备，通常按天收费" : "Heavy structures require a local crane service to hoist off flatbed onto foundations"}
                      </p>
                    </div>

                    <div className="pt-2 text-[11px] text-slate-400 leading-relaxed flex items-start space-x-1.5">
                      <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      <span>{getTranslation(language, "shippingDisclaimer")}</span>
                    </div>
                  </div>
                </div>

                {/* Landed Cost Breakdown */}
                <div className="md:col-span-7 space-y-4">
                  <div className="border border-slate-100 rounded-2xl overflow-hidden divide-y divide-slate-100 shadow-xs">
                    
                    {/* Nearest Port */}
                    <div className="flex justify-between items-center bg-slate-900 text-white p-4 text-xs font-bold">
                      <span className="flex items-center space-x-1">
                        <Anchor className="w-4 h-4 text-amber-400" />
                        <span>{getTranslation(language, "nearestPort")}</span>
                      </span>
                      <span className="text-amber-400 uppercase tracking-wide">{activePortConfig.port}</span>
                    </div>

                    {/* Cost list */}
                    <div className="divide-y divide-slate-50 text-xs">
                      <div className="flex justify-between p-3.5 bg-slate-50">
                        <span className="text-slate-500 font-medium">{isZh ? "出厂 FOB 价格" : "FOB Factory Price"}</span>
                        <span className="font-bold text-slate-900">${factoryPrice.toLocaleString()}</span>
                      </div>
                      
                      <div className="flex justify-between p-3.5">
                        <span className="text-slate-500 font-medium">{getTranslation(language, "oceanFreight")}</span>
                        <span className="font-bold text-slate-900">${oceanFreight.toLocaleString()}</span>
                      </div>

                      <div className="flex justify-between p-3.5">
                        <span className="text-slate-500 font-medium">{getTranslation(language, "importDuty")}</span>
                        <span className="font-bold text-slate-900">${importDuty.toLocaleString()}</span>
                      </div>

                      <div className="flex justify-between p-3.5">
                        <span className="text-slate-500 font-medium">{getTranslation(language, "portFees")}</span>
                        <span className="font-bold text-slate-900">${portFee.toLocaleString()}</span>
                      </div>

                      <div className="flex justify-between p-3.5">
                        <span className="text-slate-500 font-medium">{getTranslation(language, "customsClearance")}</span>
                        <span className="font-bold text-slate-900">${customsClearance}</span>
                      </div>

                      <div className="flex justify-between p-3.5">
                        <span className="text-slate-500 font-medium flex items-center space-x-1">
                          <Truck className="w-3.5 h-3.5 text-slate-400" />
                          <span>{getTranslation(language, "inlandTrucking")}</span>
                        </span>
                        <span className="font-bold text-slate-900">${inlandTrucking.toLocaleString()}</span>
                      </div>

                      <div className="flex justify-between p-3.5">
                        <span className="text-slate-500 font-medium">{isZh ? "吊车租赁费 (估算)" : "Local Crane Operator"}</span>
                        <span className="font-bold text-slate-900">${craneCost.toLocaleString()}</span>
                      </div>

                      <div className="flex justify-between p-3.5">
                        <span className="text-slate-500 font-medium">{isZh ? "地基施工与组装费 (估算)" : "Foundation & Local Labor Assembly"}</span>
                        <span className="font-bold text-slate-900">${installationEstimate.toLocaleString()}</span>
                      </div>

                      {/* Total */}
                      <div className="flex justify-between p-4 bg-amber-50 border-t border-amber-100 items-baseline">
                        <span className="text-slate-800 font-black text-sm">{getTranslation(language, "estimatedTotalLanded")}</span>
                        <div className="text-right">
                          <span className="text-2xl font-black text-amber-600">${totalLandedCost.toLocaleString()}</span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">{getTranslation(language, "pricingDisclaimer")}</span>
                        </div>
                      </div>

                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* TAB 4: REQUEST OFFICIAL QUOTE FORM */}
          {activeTab === "quote" && (
            <div className="space-y-6">
              <h4 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center space-x-2">
                <FileCheck className="w-5 h-5 text-amber-500" />
                <span>{getTranslation(language, "requestQuoteTitle")}</span>
              </h4>

              {quoteSuccessMsg ? (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-3xl p-8 text-center space-y-4 max-w-lg mx-auto">
                  <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto animate-bounce" />
                  <h5 className="text-xl font-bold">{isZh ? "提交成功！" : "Inquiry Submitted Successfully!"}</h5>
                  <p className="text-sm leading-relaxed">
                    {getTranslation(language, "quoteSuccess")}
                  </p>
                </div>
              ) : (
                <form onSubmit={handleFormSubmit} className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-slate-600 font-bold mb-1">{isZh ? "姓名" : "Full Name"}</label>
                      <input
                        type="text"
                        required
                        value={quoteForm.buyerName}
                        onChange={(e) => setQuoteForm({ ...quoteForm, buyerName: e.target.value })}
                        className="w-full border border-slate-200 rounded-lg p-2.5"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-bold mb-1">{isZh ? "邮箱" : "Email"}</label>
                      <input
                        type="email"
                        required
                        value={quoteForm.buyerEmail}
                        onChange={(e) => setQuoteForm({ ...quoteForm, buyerEmail: e.target.value })}
                        className="w-full border border-slate-200 rounded-lg p-2.5"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-bold mb-1">{isZh ? "联系电话" : "Phone"}</label>
                      <input
                        type="text"
                        value={quoteForm.buyerPhone}
                        onChange={(e) => setQuoteForm({ ...quoteForm, buyerPhone: e.target.value })}
                        className="w-full border border-slate-200 rounded-lg p-2.5"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-slate-600 font-bold mb-1">{getTranslation(language, "quantity")}</label>
                      <input
                        type="number"
                        min={1}
                        value={quoteForm.quantity}
                        onChange={(e) => setQuoteForm({ ...quoteForm, quantity: parseInt(e.target.value) || 1 })}
                        className="w-full border border-slate-200 rounded-lg p-2.5"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-bold mb-1">{isZh ? "项目意向地" : "Project Location"}</label>
                      <input
                        type="text"
                        required
                        value={quoteForm.projectLocation}
                        onChange={(e) => setQuoteForm({ ...quoteForm, projectLocation: e.target.value })}
                        className="w-full border border-slate-200 rounded-lg p-2.5"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-bold mb-1">{isZh ? "意向预算 (美元)" : "Target Budget ($)"}</label>
                      <input
                        type="number"
                        value={quoteForm.budget}
                        onChange={(e) => setQuoteForm({ ...quoteForm, budget: parseInt(e.target.value) || 0 })}
                        className="w-full border border-slate-200 rounded-lg p-2.5"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-bold mb-1">{isZh ? "期望交货时效" : "Timeline"}</label>
                      <select
                        className="w-full border border-slate-200 rounded-lg p-2.5"
                        onChange={(e) => {}}
                      >
                        <option value="urgent">{isZh ? "1-3个月 (紧急)" : "1-3 Months (Urgent)"}</option>
                        <option value="normal" selected>{isZh ? "3-6个月" : "3-6 Months"}</option>
                        <option value="flexible">{isZh ? "6个月以上" : "Flexible"}</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div>
                      <span className="block text-slate-600 font-bold mb-1">{getTranslation(language, "landStatus")}</span>
                      <div className="flex space-x-3 mt-1.5">
                        <label className="flex items-center space-x-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="landStatusModal"
                            checked={quoteForm.landStatus === "owned"}
                            onChange={() => setQuoteForm({ ...quoteForm, landStatus: "owned" })}
                            className="text-slate-900"
                          />
                          <span>{isZh ? "已拥有土地" : "Own Land"}</span>
                        </label>
                        <label className="flex items-center space-x-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="landStatusModal"
                            checked={quoteForm.landStatus === "searching"}
                            onChange={() => setQuoteForm({ ...quoteForm, landStatus: "searching" })}
                            className="text-slate-900"
                          />
                          <span>{isZh ? "正在选址中" : "Searching"}</span>
                        </label>
                      </div>
                    </div>

                    <div>
                      <span className="block text-slate-600 font-bold mb-1">{isZh ? "需要安装指导支持？" : "Assembly Assistance?"}</span>
                      <div className="flex space-x-3 mt-1.5">
                        <label className="flex items-center space-x-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={quoteForm.needInstallationSupport}
                            onChange={(e) => setQuoteForm({ ...quoteForm, needInstallationSupport: e.target.checked })}
                            className="text-slate-900 rounded"
                          />
                          <span>{isZh ? "是的" : "Yes"}</span>
                        </label>
                      </div>
                    </div>

                    <div>
                      <span className="block text-slate-600 font-bold mb-1">{isZh ? "需要资金信贷托管支持？" : "Escrow/Financing?"}</span>
                      <div className="flex space-x-3 mt-1.5">
                        <label className="flex items-center space-x-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={quoteForm.needFinancing}
                            onChange={(e) => setQuoteForm({ ...quoteForm, needFinancing: e.target.checked })}
                            className="text-slate-900 rounded"
                          />
                          <span>{isZh ? "是的" : "Yes"}</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-600 font-bold mb-1">{getTranslation(language, "customizationDetails")}</label>
                    <textarea
                      value={quoteForm.customizationRequest}
                      onChange={(e) => setQuoteForm({ ...quoteForm, customizationRequest: e.target.value })}
                      placeholder={isZh ? "例如：想加厚木质外墙，插座面板需要配美国UL标准，或要改动Loft楼梯等..." : "Describe customized materials, insulation upgrades, custom kitchen colors..."}
                      className="w-full border border-slate-200 rounded-lg p-2.5 h-20"
                    />
                  </div>

                  {/* File Upload Form */}
                  <div className="border-2 border-dashed border-slate-200 rounded-2xl p-4 text-center hover:bg-slate-50 transition-colors">
                    <label className="cursor-pointer block">
                      <FileText className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                      <span className="text-slate-700 font-bold block">{getTranslation(language, "uploadPlans")}</span>
                      <span className="text-slate-400 text-[10px] block mt-0.5">{isZh ? "支持 PDF, CAD 图纸, JPG 场地航拍图 (最大 10MB)" : "Accepts site maps, PDF drafts, jpeg photos"}</span>
                      <input
                        type="file"
                        multiple
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                    {quoteForm.uploadedFiles.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1 justify-center">
                        {quoteForm.uploadedFiles.map((fn, idx) => (
                          <span key={idx} className="bg-amber-50 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-md border border-amber-200">
                            {fn}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end space-x-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab("overview")}
                      className="px-5 py-3 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50"
                    >
                      {getTranslation(language, "cancel")}
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold"
                    >
                      {getTranslation(language, "sendInquiry")}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
