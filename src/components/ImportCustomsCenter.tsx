import React, { useState, useEffect } from "react";
import { Product, Language } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { 
  Compass, Anchor, Calculator, FileText, UserCheck, Ship, Grid, CheckCircle2, 
  AlertCircle, Upload, ArrowRight, ShieldCheck, Building2, HelpCircle, RefreshCw, 
  MapPin, DollarSign, Download, ExternalLink, Sliders, Truck, Layers, ChevronRight, FileUp
} from "lucide-react";

interface ImportCustomsCenterProps {
  language: Language;
  products: Product[];
}

interface LandInfo {
  address: string;
  parcelNumber: string;
  zipCode: string;
  state: string;
}

interface UploadedDoc {
  id: string;
  name: string;
  size: string;
  type: string;
  uploadedAt: string;
  status: "Reviewing" | "Ready" | "Missing";
}

export default function ImportCustomsCenter({ language, products }: ImportCustomsCenterProps) {
  const isZh = language === "zh";

  // Navigation Steps (1 to 9)
  const [activeStep, setActiveStep] = useState<number>(1);

  // Step 1: Zoning & Permissions State
  const [landInfo, setLandInfo] = useState<LandInfo>({
    address: "1428 Elm Street",
    parcelNumber: "123-456-789",
    zipCode: "90210",
    state: "CA"
  });
  const [zoningResult, setZoningResult] = useState<{ feasibilityIndex: number; guidance: string } | null>(null);
  const [checkingZoning, setCheckingZoning] = useState<boolean>(false);

  // Step 2: Selected Product State
  const [selectedProductId, setSelectedProductId] = useState<string>(products[0]?.id || "house_20_fold");
  const selectedProduct = products.find(p => p.id === selectedProductId) || products[0];

  // Step 3: Selected Seaport State
  const [selectedPortId, setSelectedPortId] = useState<string>("la-lb");
  
  const ports = [
    { id: "la-lb", name_en: "Port of Los Angeles / Long Beach (CA)", name_cn: "洛杉矶/长滩港 (加州)", region: "West Coast", oceanDays: 16, truckingRateBase: 350 },
    { id: "seattle", name_en: "Port of Seattle / Tacoma (WA)", name_cn: "西雅图/塔科马港 (华盛顿州)", region: "Pacific NW", oceanDays: 14, truckingRateBase: 400 },
    { id: "savannah", name_en: "Port of Savannah (GA)", name_cn: "萨凡纳港 (佐治亚州)", region: "Southeast", oceanDays: 24, truckingRateBase: 450 },
    { id: "ny-nj", name_en: "Port of New York / New Jersey (NY)", name_cn: "纽约/新泽西港 (纽约州)", region: "Northeast", oceanDays: 26, truckingRateBase: 480 },
    { id: "houston", name_en: "Port of Houston (TX)", name_cn: "休斯顿港 (德克萨斯州)", region: "Gulf Coast", oceanDays: 22, truckingRateBase: 380 },
    { id: "oakland", name_en: "Port of Oakland (CA)", name_cn: "奥克兰港 (加州)", region: "West Coast", oceanDays: 15, truckingRateBase: 360 }
  ];

  const selectedPort = ports.find(p => p.id === selectedPortId) || ports[0];

  // Step 4 & 5: Shipping, Duties & Tariffs Constants / State variables
  const containerType = selectedProduct?.requiredContainers || "1x 40HQ";
  const numContainers = containerType.toLowerCase().includes("2x") ? 2 : 1;
  
  // Logistics cost components
  const oceanFreightRate = selectedPort.region === "West Coast" ? 3800 : selectedPort.region === "Pacific NW" ? 3600 : 5400;
  const oceanFreightTotal = oceanFreightRate * numContainers;
  const marineInsurance = Math.round((selectedProduct?.price || 25000) * 0.003 * numContainers);
  const portHandlingCharges = 350 * numContainers; // THC, DDC etc.
  const customsBrokerFee = 150;
  const singleEntryBondFee = 120;
  
  // Tax calculations
  const basicImportDutyRate = 0.029; // 2.9% for steel structure modules
  const section301TariffRate = 0.25; // 25% US standard Section 301 tariff for some steel goods from CN
  const productPrice = selectedProduct?.price || 25000;
  const basicImportDuty = Math.round(productPrice * basicImportDutyRate);
  const section301Tariff = Math.round(productPrice * section301TariffRate);
  
  // Local delivery estimates
  const [deliveryMiles, setDeliveryMiles] = useState<number>(75);
  const truckingCost = Math.round(selectedPort.truckingRateBase + (deliveryMiles * 4.5) * numContainers);
  const craneCost = 1500; // Average daily mobile crane hire fee
  const foundationPrepCost = 4500; // Local estimate

  const totalLandedCost = productPrice + oceanFreightTotal + marineInsurance + portHandlingCharges + customsBrokerFee + singleEntryBondFee + basicImportDuty + section301Tariff + truckingCost + craneCost + foundationPrepCost;

  // Step 6: Interactive Documents State
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDoc[]>([
    { id: "doc_1", name: "Commercial_Invoice_Draft_FS20.pdf", size: "245 KB", type: "PDF", uploadedAt: "2026-07-03 10:15", status: "Ready" },
    { id: "doc_2", name: "Customs_Single_Entry_Bond_Form.pdf", size: "412 KB", type: "PDF", uploadedAt: "2026-07-03 10:18", status: "Reviewing" },
    { id: "doc_3", name: "Site_Plan_Zoning_APN_123.jpg", size: "1.8 MB", type: "JPG", uploadedAt: "2026-07-03 10:20", status: "Ready" }
  ]);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Step 8: Visual Voyage Simulator State
  const [voyageProgress, setVoyageProgress] = useState<number>(20); // 0 to 100%
  const [isVesselSailing, setIsVesselSailing] = useState<boolean>(false);

  // Auto-run simulations on mount
  useEffect(() => {
    let interval: any;
    if (isVesselSailing) {
      interval = setInterval(() => {
        setVoyageProgress(prev => {
          if (prev >= 100) {
            setIsVesselSailing(false);
            return 100;
          }
          return prev + 5;
        });
      }, 400);
    }
    return () => clearInterval(interval);
  }, [isVesselSailing]);

  // AI Zoning Checker Trigger
  const handleCheckZoningWithAI = async () => {
    setCheckingZoning(true);
    setZoningResult(null);

    try {
      const response = await fetch("/api/import/zoning-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: landInfo.address,
          parcelNumber: landInfo.parcelNumber,
          zipCode: landInfo.zipCode,
          state: landInfo.state,
          homeModel: selectedProduct?.name || "Prefab Home Model",
          category: selectedProduct?.category || "ADU"
        })
      });

      if (response.ok) {
        const data = await response.json();
        setZoningResult({
          feasibilityIndex: data.feasibilityIndex || 7,
          guidance: data.guidance || ""
        });
      } else {
        throw new Error("Failed to contact server zoning compliance API.");
      }
    } catch (error) {
      console.error(error);
      // Fallback
      setZoningResult({
        feasibilityIndex: 7,
        guidance: `### ⚠️ Zoning Advice Fallback (Offline Mode)
Could not fetch live response. Typical rules for **${landInfo.state}** regarding accessory housing state:
- California AB-68 bypasses local restrictions for ADUs under 800 sq ft.
- Foundation: Typically requires a permanent structural concrete foundation.
- Please verify local fire and setback regulations.`
      });
    } finally {
      setCheckingZoning(false);
    }
  };

  // Mock File upload handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const newDoc: UploadedDoc = {
        id: `doc_${Date.now()}`,
        name: file.name,
        size: `${(file.size / 1024).toFixed(0)} KB`,
        type: file.name.split('.').pop()?.toUpperCase() || "UNK",
        uploadedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
        status: "Reviewing"
      };
      setUploadedDocs(prev => [...prev, newDoc]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const newDoc: UploadedDoc = {
        id: `doc_${Date.now()}`,
        name: file.name,
        size: `${(file.size / 1024).toFixed(0)} KB`,
        type: file.name.split('.').pop()?.toUpperCase() || "UNK",
        uploadedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
        status: "Reviewing"
      };
      setUploadedDocs(prev => [...prev, newDoc]);
    }
  };

  const stepList = [
    { num: 1, title_en: "Zoning Check", title_cn: "建规核验", icon: Compass },
    { num: 2, title_en: "Choose Model", title_cn: "选定房型", icon: Grid },
    { num: 3, title_en: "Select Port", title_cn: "到货港口", icon: Anchor },
    { num: 4, title_en: "Logistics Costs", title_cn: "物流测算", icon: Calculator },
    { num: 5, title_en: "Duties & Taxes", title_cn: "关税清关", icon: DollarSign },
    { num: 6, title_en: "Document Vault", title_cn: "资料归档", icon: FileText },
    { num: 7, title_en: "Customs Broker", title_cn: "报关委托", icon: UserCheck },
    { num: 8, title_en: "Voyage Tracker", title_cn: "船运追踪", icon: Ship },
    { num: 9, title_en: "Site Assembly", title_cn: "卸货安装", icon: Truck }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" id="import-customs-center-view">
      
      {/* Page Title Header */}
      <div className="bg-slate-900 rounded-3xl p-8 text-white relative overflow-hidden shadow-lg border border-slate-800 mb-8">
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 opacity-90 z-0" />
        <div className="relative z-10 space-y-3">
          <div className="inline-flex items-center space-x-2 bg-indigo-500/20 text-indigo-300 px-3 py-1 rounded-full text-xs font-semibold">
            <ShieldCheck className="w-4 h-4" />
            <span>{isZh ? "美国个人买家合规直通车" : "Technical & Legal Compliance Route"}</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl font-sans">
            {isZh ? "进口与清关中心" : "Import & Customs Center"}
          </h1>
          <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
            {isZh 
              ? "协助美国个人买家安全高效地自中国采购预制房屋。提供智能建规咨询、跨境运费税费测算、双语清关单据库及集装箱海上航线可视化模拟。" 
              : "Helping individual U.S. buyers navigate the exact regulations of importing prefabricated structures from China. Plan zoning compliance, calculate tariffs, manage document archives, and track cargo."}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* LEFT COLUMN: NAVIGATION SIDEBAR */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-3xs">
            <h3 className="font-sans font-bold text-slate-900 text-xs tracking-wider uppercase mb-3 px-2">
              {isZh ? "进口九大阶段" : "9 Phases of Import"}
            </h3>
            
            <div className="space-y-1">
              {stepList.map((step) => {
                const StepIcon = step.icon;
                const isActive = activeStep === step.num;
                const isPassed = activeStep > step.num;

                return (
                  <button
                    key={step.num}
                    onClick={() => setActiveStep(step.num)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs transition-all ${
                      isActive 
                        ? "bg-indigo-600 text-white font-bold shadow-xs shadow-indigo-600/10" 
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-[11px] ${
                        isActive 
                          ? "bg-white/20 text-white" 
                          : isPassed 
                            ? "bg-green-50 text-green-600" 
                            : "bg-slate-100 text-slate-500"
                      }`}>
                        {isPassed ? <CheckCircle2 className="w-3.5 h-3.5" /> : step.num}
                      </div>
                      <span className="text-left">
                        {isZh ? step.title_cn : step.title_en}
                      </span>
                    </div>
                    <ChevronRight className={`w-3.5 h-3.5 opacity-60 ${isActive ? "text-white" : "text-slate-400"}`} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sourcing State Summary Box */}
          <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 border border-amber-200/50 rounded-2xl p-5 space-y-3.5">
            <span className="text-xs font-black tracking-wider text-amber-800 uppercase block">
              {isZh ? "实时通关状态汇总" : "Import Summary Status"}
            </span>
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between border-b border-amber-200/30 pb-2">
                <span className="text-amber-700">{isZh ? "拟定房型:" : "Home Model:"}</span>
                <span className="font-bold text-slate-900">{selectedProduct?.name}</span>
              </div>
              <div className="flex justify-between border-b border-amber-200/30 pb-2">
                <span className="text-amber-700">{isZh ? "目的州 / 邮编:" : "State / ZIP:"}</span>
                <span className="font-bold text-slate-900">{landInfo.state} ({landInfo.zipCode})</span>
              </div>
              <div className="flex justify-between border-b border-amber-200/30 pb-2">
                <span className="text-amber-700">{isZh ? "卸货海运港口:" : "Discharge Port:"}</span>
                <span className="font-bold text-slate-900">{isZh ? selectedPort.name_cn : selectedPort.name_en}</span>
              </div>
              <div className="flex justify-between border-b border-amber-200/30 pb-2">
                <span className="text-amber-700">{isZh ? "集装箱总规格:" : "Container Required:"}</span>
                <span className="font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[10px] uppercase font-mono">{containerType}</span>
              </div>
              <div className="flex justify-between pt-1">
                <span className="text-amber-700 font-bold">{isZh ? "综合测算到岸价:" : "Est. Landed Cost:"}</span>
                <span className="font-black text-amber-600 font-mono text-sm">${totalLandedCost.toLocaleString()} USD</span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: ACTIVE STEP WORKSPACE */}
        <div className="lg:col-span-3">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeStep}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="bg-white border border-slate-100 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6"
            >

              {/* STEP 1: LAND COMPLIANCE & ZONING (AI DRIVEN) */}
              {activeStep === 1 && (
                <div className="space-y-6" id="step-zoning-check">
                  <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                    <div>
                      <h2 className="font-sans font-bold text-slate-900 text-lg">
                        {isZh ? "第一阶段：土地规划与许可 (Zoning & Permits)" : "Phase 1: Zoning & Local Regulations Verification"}
                      </h2>
                      <p className="text-xs text-slate-400 mt-1">
                        {isZh 
                          ? "在自中国下定金之前，务必核实土地地方法规是否允许安放预制模块屋。" 
                          : "Before placing any factory deposit, you must verify county zoning setbacks, ADU laws, and foundation permits."}
                      </p>
                    </div>
                    <span className="bg-indigo-50 text-indigo-600 font-bold text-xs px-2.5 py-1 rounded-full uppercase">
                      Step 1/9
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Land Form */}
                    <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl space-y-4">
                      <h3 className="font-sans font-bold text-slate-800 text-xs tracking-wide uppercase">
                        {isZh ? "请输入您的土地及房产基本信息" : "Enter Local Land Parameters"}
                      </h3>
                      
                      <div className="space-y-3.5">
                        <div>
                          <label className="block text-xs font-bold text-slate-600 mb-1">{isZh ? "土地地址" : "Street Address"}</label>
                          <input
                            type="text"
                            value={landInfo.address}
                            onChange={(e) => setLandInfo({...landInfo, address: e.target.value})}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs outline-hidden focus:ring-1 focus:ring-indigo-500"
                            placeholder="e.g. 1428 Elm Street"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1">{isZh ? "所属州" : "U.S. State"}</label>
                            <select
                              value={landInfo.state}
                              onChange={(e) => setLandInfo({...landInfo, state: e.target.value})}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs outline-hidden focus:ring-1 focus:ring-indigo-500"
                            >
                              <option value="CA">California (CA)</option>
                              <option value="TX">Texas (TX)</option>
                              <option value="FL">Florida (FL)</option>
                              <option value="WA">Washington (WA)</option>
                              <option value="NY">New York (NY)</option>
                              <option value="AZ">Arizona (AZ)</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1">{isZh ? "邮政编码" : "ZIP Code"}</label>
                            <input
                              type="text"
                              value={landInfo.zipCode}
                              onChange={(e) => setLandInfo({...landInfo, zipCode: e.target.value})}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs outline-hidden focus:ring-1 focus:ring-indigo-500"
                              placeholder="90210"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-600 mb-1">
                            {isZh ? "地块号 / APN" : "Parcel Number (APN)"}
                          </label>
                          <input
                            type="text"
                            value={landInfo.parcelNumber}
                            onChange={(e) => setLandInfo({...landInfo, parcelNumber: e.target.value})}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs outline-hidden focus:ring-1 focus:ring-indigo-500"
                            placeholder="e.g. 123-456-789"
                          />
                        </div>

                        <button
                          onClick={handleCheckZoningWithAI}
                          disabled={checkingZoning}
                          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-3 rounded-xl flex items-center justify-center space-x-2 transition-colors cursor-pointer"
                        >
                          {checkingZoning ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              <span>{isZh ? "正在呼叫 AI 顾问检索美国法规..." : "Consulting AI Zoning Specialist..."}</span>
                            </>
                          ) : (
                            <>
                              <Compass className="w-4 h-4" />
                              <span>{isZh ? "运行 AI 土地建规核对" : "Check with AI Zoning Assistant"}</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Zoning Report Display */}
                    <div className="flex flex-col justify-between">
                      {checkingZoning ? (
                        <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 border border-dashed border-slate-200 p-12 rounded-2xl text-center space-y-4">
                          <div className="w-12 h-12 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin flex items-center justify-center" />
                          <div>
                            <h4 className="font-sans font-bold text-slate-700 text-sm">{isZh ? "正在深度检索 U.S. Building Code" : "Reading U.S. Building Codes..."}</h4>
                            <p className="text-xs text-slate-400 mt-1">{isZh ? "分析美标 NEC 电路、UPC 给排水系统及地方 ADU 红线退让法律..." : "Evaluating setbacks, structural loads, and regional foundation stamps..."}</p>
                          </div>
                        </div>
                      ) : zoningResult ? (
                        <div className="flex-1 bg-indigo-950/5 border border-indigo-100 rounded-2xl p-5 flex flex-col space-y-4">
                          {/* Radial Score Gauge */}
                          <div className="flex items-center space-x-4">
                            <div className="relative w-16 h-16 flex items-center justify-center rounded-full bg-white shadow-xs">
                              {/* Simple SVG circle loader */}
                              <svg className="w-14 h-14 transform -rotate-90">
                                <circle cx="28" cy="28" r="24" className="stroke-slate-100 fill-none" strokeWidth="4" />
                                <circle cx="28" cy="28" r="24" className="stroke-indigo-600 fill-none" strokeWidth="4" strokeDasharray={`${2 * Math.PI * 24}`} strokeDashoffset={`${2 * Math.PI * 24 * (1 - zoningResult.feasibilityIndex / 10)}`} />
                              </svg>
                              <span className="absolute font-sans font-black text-indigo-900 text-sm">{zoningResult.feasibilityIndex}/10</span>
                            </div>
                            <div>
                              <h4 className="font-sans font-bold text-slate-900 text-sm">{isZh ? "AI 规划可行性指数" : "AI Zoning Feasibility Score"}</h4>
                              <p className="text-xs text-slate-400">{zoningResult.feasibilityIndex >= 7 ? (isZh ? "通过概率高，符合简化审批流程" : "Highly feasible, streamline reviews apply") : (isZh ? "中度风险，需要联系当地工程师核对" : "Medium risk, requires engineer stamps")}</p>
                            </div>
                          </div>

                          <div className="flex-1 overflow-y-auto max-h-56 text-xs text-slate-700 leading-relaxed space-y-2 pr-2 border-t border-indigo-100/40 pt-3">
                            {/* Format paragraphs */}
                            {zoningResult.guidance.split("\n").map((line, idx) => {
                              if (line.startsWith("###")) {
                                return <h4 key={idx} className="font-bold text-slate-900 text-sm mt-3 mb-1">{line.replace("###", "").trim()}</h4>;
                              }
                              if (line.startsWith("-") || line.startsWith("* ")) {
                                return <li key={idx} className="ml-4 list-disc mb-1">{line.replace(/^[-*]\s*/, "")}</li>;
                              }
                              if (line.startsWith("1.") || line.startsWith("2.") || line.startsWith("3.")) {
                                return <p key={idx} className="font-semibold text-slate-800 mt-2 mb-1">{line}</p>;
                              }
                              return <p key={idx} className="mb-2">{line}</p>;
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 border border-slate-100 p-8 rounded-2xl text-center space-y-3">
                          <Compass className="w-10 h-10 text-slate-300 animate-pulse" />
                          <div>
                            <h4 className="font-sans font-bold text-slate-700 text-xs uppercase tracking-wide">{isZh ? "等待运行核对" : "Awaiting Feasibility Check"}</h4>
                            <p className="text-xs text-slate-400 mt-1 max-w-xs">{isZh ? "点击左侧按钮，由 AI 结合您的土地 APN 与选择的房型进行全面的国际规范、结构隔热及基础适应性核算。" : "Submit details to review real-time wind rating warnings, setbacks constraints and engineer stamp requirements."}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Warning banner */}
                  <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start space-x-3 text-xs text-amber-800">
                    <AlertCircle className="w-4.5 h-4.5 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block font-bold">{isZh ? "法律合规重要声明" : "Critical Legal Notice"}</strong>
                      <p className="leading-relaxed mt-1">
                        {isZh 
                          ? "装配式钢结构由于是预制，地方法规要求图纸必须具备本州注册执业结构工程师 (PE Seal) 签章方可申请开工证。中国工厂提供 CAD 详图，买家须自行寻址当地工程师加盖 PE Seal。平台可引荐合作持牌报关行和认证机构。" 
                          : "U.S. municipal codes usually require prefabricated structures to have structural calculations stamped by a locally registered Professional Engineer (PE Seal) before a building permit is issued. Chinese suppliers supply detailed CAD layouts, but local zoning verification rests solely on the landowner."}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: CHOOSE MODEL */}
              {activeStep === 2 && (
                <div className="space-y-6" id="step-choose-model">
                  <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                    <div>
                      <h2 className="font-sans font-bold text-slate-900 text-lg">
                        {isZh ? "第二阶段：锁定预制房型号 (Lock Modular Design)" : "Phase 2: Select & Lock Your Modular Prefab Home"}
                      </h2>
                      <p className="text-xs text-slate-400 mt-1">
                        {isZh 
                          ? "不同的体积尺寸对国际海运集装箱的使用规格 (40HQ / Flat Rack) 以及总重量有决定性影响。" 
                          : "Prefab size and weight directly dictate the required ocean container dimensions and inland trucking rig ratings."}
                      </p>
                    </div>
                    <span className="bg-indigo-50 text-indigo-600 font-bold text-xs px-2.5 py-1 rounded-full uppercase">
                      Step 2/9
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Catalog selectors */}
                    <div className="md:col-span-1 space-y-2 max-h-96 overflow-y-auto pr-1">
                      <span className="text-[10px] font-black uppercase text-slate-400 block px-2 mb-1">{isZh ? "可导入房源目录" : "Available Import Catalog"}</span>
                      {products.map(p => (
                        <button
                          key={p.id}
                          onClick={() => setSelectedProductId(p.id)}
                          className={`w-full text-left p-3 rounded-xl border text-xs transition-all ${
                            selectedProductId === p.id 
                              ? "bg-slate-900 text-white border-slate-900 shadow-xs" 
                              : "bg-white text-slate-600 border-slate-100 hover:border-slate-200"
                          }`}
                        >
                          <div className="font-bold flex justify-between items-center">
                            <span>{p.name}</span>
                            <span className="font-mono text-[10px] text-amber-500 font-black">${p.price.toLocaleString()}</span>
                          </div>
                          <div className="text-[10px] opacity-70 mt-1 flex justify-between">
                            <span>{p.category}</span>
                            <span>{p.area} sq ft</span>
                          </div>
                        </button>
                      ))}
                    </div>

                    {/* Specifications details */}
                    <div className="md:col-span-2 bg-slate-50 rounded-2xl p-6 grid grid-cols-1 sm:grid-cols-2 gap-6 border border-slate-100">
                      <div className="space-y-4">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 block uppercase">{isZh ? "商品名称" : "Model Name"}</span>
                          <h3 className="font-sans font-black text-slate-800 text-base">{selectedProduct.name}</h3>
                          <span className="text-xs text-slate-500 font-mono mt-0.5 block">{isZh ? "型号" : "Model No"}: {selectedProduct.modelNumber}</span>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-xs">
                          <div>
                            <span className="text-slate-400 block">{isZh ? "出厂价格 (FOB)" : "Factory FOB Price"}</span>
                            <strong className="text-slate-800 font-mono text-base font-black">${selectedProduct.price.toLocaleString()}</strong>
                          </div>
                          <div>
                            <span className="text-slate-400 block">{isZh ? "集装箱包装规格" : "Container Packaging"}</span>
                            <strong className="text-indigo-600 font-mono font-bold bg-indigo-50 px-1.5 py-0.5 rounded text-[10px] uppercase inline-block mt-0.5">{selectedProduct.requiredContainers}</strong>
                          </div>
                          <div>
                            <span className="text-slate-400 block">{isZh ? "卧室/卫浴数量" : "Beds / Baths"}</span>
                            <strong className="text-slate-800 font-bold">{selectedProduct.bedrooms} Bed / {selectedProduct.bathrooms} Bath</strong>
                          </div>
                          <div>
                            <span className="text-slate-400 block">{isZh ? "室内面积" : "Interior Area"}</span>
                            <strong className="text-slate-800 font-bold">{selectedProduct.area} sq ft</strong>
                          </div>
                        </div>

                        <div className="border-t border-slate-200/60 pt-3">
                          <span className="text-[10px] font-bold text-slate-400 block uppercase">{isZh ? "装载总净重" : "Cargo Net Weight"}</span>
                          <strong className="text-slate-800 font-mono text-xs font-bold">{selectedProduct.weight ? selectedProduct.weight.toLocaleString() : "5,800"} kg</strong>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="aspect-video w-full rounded-xl overflow-hidden bg-slate-200 relative border border-slate-200">
                          <img 
                            src={selectedProduct.image || "https://images.unsplash.com/photo-1544984243-ec57ea16fe25?w=500&auto=format&fit=crop&q=60"} 
                            alt={selectedProduct.name}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>

                        <div className="bg-indigo-50/50 p-3.5 rounded-xl text-xs text-indigo-900 border border-indigo-100/30">
                          <strong className="font-bold flex items-center space-x-1.5 mb-1 text-indigo-950">
                            <Sliders className="w-3.5 h-3.5" />
                            <span>{isZh ? "美标配套核实合格" : "U.S. Electrical Compliant"}</span>
                          </strong>
                          <p className="scale-95 origin-left text-indigo-700 leading-normal">
                            {isZh 
                              ? "该厂家已配置符合 U.S. National Electrical Code (NEC) 的阻燃穿线管、110V/220V 漏电断路配电箱。支持 NPT 螺纹 3/4 给水接口。" 
                              : "This model is equipped with pre-wired conduit and a breaker box matching U.S. NEC safety rules, using standard 3/4 NPT water inlet threading."}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: SELECT SEAPORT */}
              {activeStep === 3 && (
                <div className="space-y-6" id="step-select-port">
                  <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                    <div>
                      <h2 className="font-sans font-bold text-slate-900 text-lg">
                        {isZh ? "第三阶段：选定美国到货海运港口 (US Seaport of Entry)" : "Phase 3: Select Discharge Seaport of Entry"}
                      </h2>
                      <p className="text-xs text-slate-400 mt-1">
                        {isZh 
                          ? "船运费、通关税率和后期的平板低平板拖车费用取决于到港距离。" 
                          : "Ocean freight sailing timelines and local flatbed trucking costs directly vary depending on the chosen port."}
                      </p>
                    </div>
                    <span className="bg-indigo-50 text-indigo-600 font-bold text-xs px-2.5 py-1 rounded-full uppercase">
                      Step 3/9
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Seaports directory */}
                    <div className="space-y-2.5">
                      <span className="text-[10px] font-bold text-slate-400 block uppercase mb-1">{isZh ? "拟定美国入境港口" : "Select Discharge Seaport"}</span>
                      {ports.map(port => (
                        <button
                          key={port.id}
                          onClick={() => setSelectedPortId(port.id)}
                          className={`w-full text-left p-3.5 rounded-xl border text-xs transition-all flex justify-between items-center ${
                            selectedPortId === port.id 
                              ? "bg-indigo-600 text-white border-indigo-600 shadow-xs shadow-indigo-600/10" 
                              : "bg-white text-slate-600 border-slate-100 hover:border-slate-200"
                          }`}
                        >
                          <div className="flex items-center space-x-3">
                            <Anchor className="w-4 h-4 shrink-0" />
                            <div>
                              <strong className="font-bold block">{isZh ? port.name_cn : port.name_en}</strong>
                              <span className={`text-[10px] inline-block font-semibold px-1 rounded mt-0.5 ${selectedPortId === port.id ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`}>{port.region}</span>
                            </div>
                          </div>
                          <span className="text-[10px] font-mono opacity-80">{port.oceanDays} {isZh ? "天海运" : "days sailing"}</span>
                        </button>
                      ))}
                    </div>

                    {/* Shipping instructions / Port facts */}
                    <div className="bg-slate-50 border border-slate-100 p-6 rounded-2xl flex flex-col justify-between">
                      <div className="space-y-4">
                        <div className="flex items-center space-x-2 text-indigo-900">
                          <MapPin className="w-4 h-4 text-indigo-600" />
                          <h3 className="font-sans font-black text-xs uppercase tracking-wide">{isZh ? "当前所选港口航行概要" : "Selected Port Sailing Brief"}</h3>
                        </div>

                        <div className="space-y-3 text-xs">
                          <div className="flex justify-between border-b border-slate-200 pb-2">
                            <span className="text-slate-500">{isZh ? "卸货港口名称:" : "Seaport of Entry:"}</span>
                            <span className="font-bold text-slate-800">{isZh ? selectedPort.name_cn : selectedPort.name_en}</span>
                          </div>
                          <div className="flex justify-between border-b border-slate-200 pb-2">
                            <span className="text-slate-500">{isZh ? "海上平均航程时效:" : "Est. Ocean Transit:"}</span>
                            <span className="font-bold text-slate-800">{selectedPort.oceanDays} days (from Shanghai/Shenzhen)</span>
                          </div>
                          <div className="flex justify-between border-b border-slate-200 pb-2">
                            <span className="text-slate-500">{isZh ? "后段陆运起步拖车价:" : "Trucking Dispatch Base Rate:"}</span>
                            <span className="font-bold text-slate-800 font-mono">${selectedPort.truckingRateBase} USD</span>
                          </div>
                        </div>

                        <p className="text-[11px] text-slate-400 leading-relaxed pt-2">
                          {isZh 
                            ? "注：货船自中国华东/华南港口装箱离港后，跨太平洋抵达美西港口（如洛杉矶/西雅图）速度最快，约为 14-16 天；抵达美东或美湾港口（如纽约/休斯顿）需要穿过巴拿马运河，历时约 22-26 天。陆运物流费通常采用“基础起步价 + 按英里计费（每英里约 4.5 美元）”。" 
                            : "Note: Container freight shipping from Eastern/Southern China takes 14-16 sailing days to the U.S. West Coast. Shipping to the East Coast or Gulf Coast (via the Panama Canal) averages 22-26 days. Flatbed local trucking incorporates a fixed seaport launch rate plus $4.50 per mile per container."}
                        </p>
                      </div>

                      <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-xl flex items-center space-x-2.5 text-xs text-indigo-900 mt-4">
                        <ShieldCheck className="w-4 h-4 shrink-0 text-indigo-600" />
                        <span>{isZh ? "推荐采用 FOB 起航港口 Incoterms" : "Incoterms FOB Shipment is recommended"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 4: LOGISTICS COSTS ESTIMATION */}
              {activeStep === 4 && (
                <div className="space-y-6" id="step-logistics-costs">
                  <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                    <div>
                      <h2 className="font-sans font-bold text-slate-900 text-lg">
                        {isZh ? "第四阶段：全链路国际物流费用测算 (Logistics Calculator)" : "Phase 4: Global Ocean & Local Logistics Cost Breakdown"}
                      </h2>
                      <p className="text-xs text-slate-400 mt-1">
                        {isZh 
                          ? "测算出厂后到您工地的所有海运箱位、目的港吊装及卡车拖行费用。" 
                          : "Configure your delivery mileage from the discharge port to your final construction site."}
                      </p>
                    </div>
                    <span className="bg-indigo-50 text-indigo-600 font-bold text-xs px-2.5 py-1 rounded-full uppercase">
                      Step 4/9
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Parameters adjuster */}
                    <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl space-y-4">
                      <h3 className="font-sans font-bold text-slate-800 text-xs tracking-wide uppercase">
                        {isZh ? "调整终点运送里程" : "Adjust Inland Distance parameters"}
                      </h3>

                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-600 mb-1 flex justify-between">
                            <span>{isZh ? "港口到工地的陆运距离:" : "Inland Flatbed Distance:"}</span>
                            <span className="text-indigo-600 font-mono font-bold">{deliveryMiles} miles</span>
                          </label>
                          <input
                            type="range"
                            min="10"
                            max="500"
                            step="10"
                            value={deliveryMiles}
                            onChange={(e) => setDeliveryMiles(Number(e.target.value))}
                            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                          />
                          <span className="text-[10px] text-slate-400 mt-1 flex justify-between">
                            <span>10 miles</span>
                            <span>500 miles</span>
                          </span>
                        </div>

                        <div className="border-t border-slate-200/60 pt-4 space-y-3.5 text-xs text-slate-600">
                          <h4 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">{isZh ? "海运物流假设" : "Shipping Logistics Constraints"}</h4>
                          <div className="flex justify-between">
                            <span>{isZh ? "选定箱型 (包装后):" : "Packaged Container:"}</span>
                            <strong className="text-slate-800 font-mono">{containerType}</strong>
                          </div>
                          <div className="flex justify-between">
                            <span>{isZh ? "集装箱总数:" : "Number of Containers:"}</span>
                            <strong className="text-slate-800">{numContainers} Unit(s)</strong>
                          </div>
                          <div className="flex justify-between">
                            <span>{isZh ? "单箱海运费单价:" : "Rate per Container:"}</span>
                            <strong className="text-slate-800 font-mono">${oceanFreightRate} USD</strong>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Logistics bill of costs */}
                    <div className="space-y-3">
                      <span className="text-[10px] font-bold text-slate-400 block uppercase mb-1">{isZh ? "物流费用明细表" : "Ocean & Local Trucking Bill"}</span>
                      
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                          <span className="text-slate-500">{isZh ? "1. 国际海运费 (40HQ柜):" : "1. Ocean Carrier Freight:"}</span>
                          <span className="font-bold text-slate-800 font-mono">${oceanFreightTotal.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                          <span className="text-slate-500">{isZh ? "2. 国际货运保险 (Marine Insurance):" : "2. Marine Cargo Insurance:"}</span>
                          <span className="font-bold text-slate-800 font-mono">${marineInsurance}</span>
                        </div>
                        <div className="flex justify-between bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                          <span className="text-slate-500">{isZh ? "3. 目的港码头杂费 (THC, Port Fees):" : "3. Discharge Port Handling (THC):"}</span>
                          <span className="font-bold text-slate-800 font-mono">${portHandlingCharges}</span>
                        </div>
                        <div className="flex justify-between bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                          <span className="text-slate-500">{isZh ? "4. 平板低平板卡车陆运到工地:" : "4. Flatbed Truck Dispatch to site:"}</span>
                          <span className="font-bold text-slate-800 font-mono">${truckingCost.toLocaleString()}</span>
                        </div>
                        
                        <div className="border-t border-dashed border-slate-200 pt-3 flex justify-between text-slate-900 font-bold px-1 text-sm">
                          <span>{isZh ? "物流开支总和 (不含税费):" : "Total Logistics Subtotal:"}</span>
                          <span className="font-mono text-indigo-600">${(oceanFreightTotal + marineInsurance + portHandlingCharges + truckingCost).toLocaleString()} USD</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 5: US IMPORT DUTIES & TAXES */}
              {activeStep === 5 && (
                <div className="space-y-6" id="step-duties-taxes">
                  <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                    <div>
                      <h2 className="font-sans font-bold text-slate-900 text-lg">
                        {isZh ? "第五阶段：美国进口关税与清关规费 (Duties & Tariffs)" : "Phase 5: U.S. Customs Clearance, Duties & Section 301 Tariffs"}
                      </h2>
                      <p className="text-xs text-slate-400 mt-1">
                        {isZh 
                          ? "进口钢结构模块住宅在美国海关可能面临附加税 (HTS 编号审核)。" 
                          : "U.S. Customs borders enforce strict tariff codes on imported steel modular units."}
                      </p>
                    </div>
                    <span className="bg-indigo-50 text-indigo-600 font-bold text-xs px-2.5 py-1 rounded-full uppercase">
                      Step 5/9
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* HTS Code info block */}
                    <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl space-y-4">
                      <div className="flex items-center space-x-2 text-slate-900 font-bold text-xs uppercase tracking-wide">
                        <ShieldCheck className="w-4 h-4 text-slate-600" />
                        <span>{isZh ? "海关税则归类编码 (HTS Code)" : "HTS Code Classification & Tariffs"}</span>
                      </div>

                      <div className="space-y-3.5 text-xs text-slate-600">
                        <p className="leading-relaxed">
                          {isZh 
                            ? "模块化集成房屋在美国海关通常归类于 HTS 编码 **9406.90.0030** (装配式钢结构建筑物)。" 
                            : "Prefabricated metal buildings are classified under Harmonized Tariff Schedule (HTS) **9406.90.0030**."}
                        </p>
                        
                        <div className="border-t border-slate-200/60 pt-3 space-y-2.5">
                          <div className="flex justify-between">
                            <span>{isZh ? "美国协定基本关税率 (Duty Rate):" : "U.S. standard basic duty rate:"}</span>
                            <span className="font-bold text-slate-800">2.9%</span>
                          </div>
                          <div className="flex justify-between">
                            <span>{isZh ? "中国原产地 Section 301 惩罚性关税:" : "Section 301 punitive tariff for China:"}</span>
                            <span className="font-bold text-amber-600">25.0%</span>
                          </div>
                        </div>

                        <div className="bg-amber-50 border border-amber-200/50 p-3.5 rounded-xl text-[11px] text-amber-800 leading-normal">
                          {isZh 
                            ? "⚠️ 提示：部分买家通过先海运至第三方国家重新组装以规避 Section 301 附加关税，但正常直航美国关税为 2.9% + 25.0% 附加税。清关需要买家提供 HTS 编码，并在装船前 24 小时内由报关行代为申报 ISF 10+2 文件。" 
                            : "⚠️ Notice: Straight shipments from Chinese ports are subject to the 2.9% basic duty plus 25% Section 301 steel tariffs. Your Customs Broker must submit ISF 10+2 documentation at least 24 hours prior to vessel departure from China."}
                        </div>
                      </div>
                    </div>

                    {/* Tax cost calculation */}
                    <div className="space-y-3">
                      <span className="text-[10px] font-bold text-slate-400 block uppercase mb-1">{isZh ? "海关进口规费明细单" : "Customs Border Clearance Fees"}</span>
                      
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                          <span className="text-slate-500">{isZh ? "申报产品货值 (FOB Value):" : "Declared FOB Value:"}</span>
                          <span className="font-bold text-slate-800 font-mono">${productPrice.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                          <span className="text-slate-500">{isZh ? "基础关税 (2.9%):" : "Basic Customs Duty (2.9%):"}</span>
                          <span className="font-bold text-slate-800 font-mono">${basicImportDuty.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between bg-slate-50 p-2.5 rounded-lg border border-slate-100 font-medium">
                          <span className="text-amber-700">{isZh ? "Section 301 中国高架钢材税 (25%):" : "Section 301 Chinese Steel Tariff (25%):"}</span>
                          <span className="font-bold text-amber-700 font-mono">${section301Tariff.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                          <span className="text-slate-500">{isZh ? "海关单一进口报关保证信 (Single Entry Bond):" : "Single Entry Customs Bond Fee:"}</span>
                          <span className="font-bold text-slate-800 font-mono">${singleEntryBondFee}</span>
                        </div>
                        <div className="flex justify-between bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                          <span className="text-slate-500">{isZh ? "报关代理单证手续费:" : "Broker Filing Entry Fee:"}</span>
                          <span className="font-bold text-slate-800 font-mono">${customsBrokerFee}</span>
                        </div>

                        <div className="border-t border-dashed border-slate-200 pt-3 flex justify-between text-slate-900 font-bold px-1 text-sm">
                          <span>{isZh ? "进口税费规费总和:" : "Total Customs & Taxes:"}</span>
                          <span className="font-mono text-indigo-600">${(basicImportDuty + section301Tariff + singleEntryBondFee + customsBrokerFee).toLocaleString()} USD</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 6: REQUIRED DOCUMENTS VAULT */}
              {activeStep === 6 && (
                <div className="space-y-6" id="step-document-vault">
                  <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                    <div>
                      <h2 className="font-sans font-bold text-slate-900 text-lg">
                        {isZh ? "第六阶段：跨境中英文清关单据库 (Document Vault)" : "Phase 6: Bilingual Customs Document Vault"}
                      </h2>
                      <p className="text-xs text-slate-400 mt-1">
                        {isZh 
                          ? "将厂家提供的出口单证、您的土地资料和海关委托信在此一站式集中存档，可供直接发送给报关行。" 
                          : "Manage, preview, and upload all required international export/import paperwork in one secure place."}
                      </p>
                    </div>
                    <span className="bg-indigo-50 text-indigo-600 font-bold text-xs px-2.5 py-1 rounded-full uppercase">
                      Step 6/9
                    </span>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Drag and Drop Zone */}
                    <div className="lg:col-span-1 space-y-4">
                      <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-3 ${
                          isDragging 
                            ? "border-indigo-600 bg-indigo-50/40" 
                            : "border-slate-200 hover:border-indigo-400 bg-slate-50"
                        }`}
                      >
                        <FileUp className={`w-8 h-8 ${isDragging ? "text-indigo-600 animate-bounce" : "text-slate-400"}`} />
                        <div>
                          <strong className="block text-xs text-slate-800 font-bold">{isZh ? "拖拽文件到这里上传" : "Drag & Drop files here"}</strong>
                          <span className="text-[10px] text-slate-400 mt-0.5 block">{isZh ? "支持 PDF, JPG, PNG 最大 10MB" : "Supports PDF, JPG, PNG up to 10MB"}</span>
                        </div>
                        <label className="bg-white text-indigo-600 border border-indigo-200 hover:bg-indigo-50 font-bold text-xs px-3.5 py-1.5 rounded-xl block cursor-pointer transition-colors shadow-3xs">
                          <span>{isZh ? "选择本地文件" : "Browse Files"}</span>
                          <input type="file" onChange={handleFileUpload} className="hidden" />
                        </label>
                      </div>

                      {/* Required Documents checklist reference */}
                      <div className="bg-slate-900 text-white rounded-2xl p-4 space-y-3 text-xs border border-slate-800">
                        <span className="font-bold text-amber-400 text-[10px] tracking-wider uppercase block">{isZh ? "海关检查强制清单" : "Customs Required List"}</span>
                        <div className="space-y-1.5 opacity-90 scale-95 origin-left">
                          <p className="flex items-center space-x-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                            <span>{isZh ? "形式发票 (Commercial Invoice)" : "Commercial Invoice"}</span>
                          </p>
                          <p className="flex items-center space-x-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                            <span>{isZh ? "装箱单 (Packing List)" : "Packing List"}</span>
                          </p>
                          <p className="flex items-center space-x-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                            <span>{isZh ? "海运提单 (Bill of Lading - B/L)" : "Bill of Lading (B/L)"}</span>
                          </p>
                          <p className="flex items-center space-x-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                            <span>{isZh ? "安全申报 (ISF 10+2 Form)" : "ISF 10+2 Filing"}</span>
                          </p>
                          <p className="flex items-center space-x-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                            <span>{isZh ? "EPA 排放豁免/电气认证证书" : "CE/EPA Certification documents"}</span>
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Active Uploads */}
                    <div className="lg:col-span-2 space-y-3">
                      <span className="text-[10px] font-bold text-slate-400 block uppercase mb-1">{isZh ? "已归档单据库" : "Archived Documents"}</span>
                      
                      <div className="space-y-2">
                        {uploadedDocs.map(doc => (
                          <div key={doc.id} className="flex justify-between items-center bg-slate-50 border border-slate-100 p-3.5 rounded-xl text-xs">
                            <div className="flex items-center space-x-3 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-[10px] font-mono shrink-0">
                                {doc.type}
                              </div>
                              <div className="min-w-0">
                                <strong className="font-bold text-slate-800 block truncate">{doc.name}</strong>
                                <span className="text-[10px] text-slate-400 block">{doc.size} • {isZh ? "存档于" : "Uploaded"} {doc.uploadedAt}</span>
                              </div>
                            </div>

                            <div className="flex items-center space-x-3 shrink-0">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                doc.status === "Ready" 
                                  ? "bg-green-50 text-green-700" 
                                  : doc.status === "Reviewing"
                                    ? "bg-amber-50 text-amber-700"
                                    : "bg-red-50 text-red-700"
                              }`}>
                                {isZh 
                                  ? (doc.status === "Ready" ? "校验合格" : doc.status === "Reviewing" ? "人工审核中" : "资料缺失")
                                  : doc.status
                                }
                              </span>
                              <button className="text-slate-400 hover:text-slate-900 transition-colors">
                                <Download className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Prefab generated draft templates */}
                      <div className="border border-slate-100 p-4 rounded-xl mt-4 bg-indigo-50/30">
                        <h4 className="font-bold text-indigo-950 text-xs flex items-center space-x-1.5">
                          <Layers className="w-4 h-4 text-indigo-600" />
                          <span>{isZh ? "平台自动生成买家报关单草稿" : "Automated Document Draft Generation"}</span>
                        </h4>
                        <p className="text-[11px] text-slate-500 leading-normal mt-1.5">
                          {isZh 
                            ? "我们的系统已经根据您在 Step 2 锁定的房型和 Step 3 锁定的港口，自动为您组装了符合美国海关入关申报规范的 Commercial Invoice & Packing List 双语形式单据草稿。" 
                            : "Our platform pre-generates formal Commercial Invoice & Packing List drafts, formatted to direct Customs Broker entry specifications for modular house shipments."}
                        </p>
                        <div className="flex space-x-3 mt-3">
                          <button className="bg-white hover:bg-slate-50 text-indigo-600 border border-indigo-200 font-bold text-[10px] px-3 py-1.5 rounded-lg flex items-center space-x-1 transition-colors shadow-3xs cursor-pointer">
                            <Download className="w-3 h-3" />
                            <span>{isZh ? "预览并下载 CI 报关草稿" : "Preview CI Draft"}</span>
                          </button>
                          <button className="bg-white hover:bg-slate-50 text-indigo-600 border border-indigo-200 font-bold text-[10px] px-3 py-1.5 rounded-lg flex items-center space-x-1 transition-colors shadow-3xs cursor-pointer">
                            <Download className="w-3 h-3" />
                            <span>{isZh ? "预览并下载 PL 报关草稿" : "Preview PL Draft"}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 7: CUSTOMS BROKER REFERRALS */}
              {activeStep === 7 && (
                <div className="space-y-6" id="step-customs-broker">
                  <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                    <div>
                      <h2 className="font-sans font-bold text-slate-900 text-lg">
                        {isZh ? "第七阶段：委托持牌美国报关行 (U.S. Customs Broker)" : "Phase 7: Nominate Your Licensed U.S. Customs Broker"}
                      </h2>
                      <p className="text-xs text-slate-400 mt-1">
                        {isZh 
                          ? "个人买家无权直接向美国海关进行商业申报，必须通过报关行办理 Importer of Record (IOR) 申报并代理完税。" 
                          : "U.S. individuals cannot personally file self-entry imports. You must appoint a licensed customs broker."}
                      </p>
                    </div>
                    <span className="bg-indigo-50 text-indigo-600 font-bold text-xs px-2.5 py-1 rounded-full uppercase">
                      Step 7/9
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Broker list */}
                    <div className="space-y-3">
                      <span className="text-[10px] font-bold text-slate-400 block uppercase mb-1">{isZh ? "平台推荐持牌报关机构" : "Verified Broker Directories"}</span>
                      
                      <div className="space-y-3">
                        {[
                          { name: "Livingston International", scope: "Specialized in bulky prefabricated modular clearances", rating: "4.9", contact: "customs-modular@livingston.com" },
                          { name: "Expeditors International", scope: "Excellent bulk flat-rack ocean logistics clearing", rating: "4.8", contact: "import-sc@expeditors.com" },
                          { name: "DHL Global Forwarding (U.S.)", scope: "Direct cross-border B2C logistics and bonded warehouses", rating: "4.7", contact: "us-brokerage@dhl.com" },
                          { name: "UPS Supply Chain Solutions", scope: "Full Single Entry Bond underwriting & clearance combo", rating: "4.6", contact: "port-clearance@ups.com" }
                        ].map((broker, idx) => (
                          <div key={idx} className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 text-xs space-y-1">
                            <div className="flex justify-between font-bold text-slate-800">
                              <span>{broker.name}</span>
                              <span className="text-amber-500 font-black">★ {broker.rating}</span>
                            </div>
                            <p className="text-slate-400 text-[11px] leading-normal">{broker.scope}</p>
                            <div className="pt-1.5 flex justify-between items-center text-[10px] text-slate-400 border-t border-slate-150/40">
                              <span>Email: {broker.contact}</span>
                              <span className="text-indigo-600 font-semibold uppercase">{isZh ? "代办清关" : "File Entry"}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* RFQ Pack generator */}
                    <div className="bg-indigo-950 text-white rounded-2xl p-6 flex flex-col justify-between border border-slate-800 shadow-sm">
                      <div className="space-y-4">
                        <h3 className="font-sans font-black text-xs uppercase tracking-wider text-amber-400 flex items-center space-x-1.5">
                          <UserCheck className="w-4 h-4 text-amber-400" />
                          <span>{isZh ? "生成报关包与询价单" : "Broker RFQ Package Generator"}</span>
                        </h3>
                        <p className="text-xs opacity-90 leading-relaxed">
                          {isZh 
                            ? "我们的系统已为您将土地地址、APN、拟定钢结构房屋的图纸 CAD 以及海关形式发票自动打包成一个标准的“报关询价函包”。" 
                            : "Pre-assemble your address parameters, APN map details, custom drawings, and packing specifications into a single RFQ dispatch folder."}
                        </p>

                        <div className="space-y-2 pt-2 border-t border-slate-800 text-[11px] opacity-80">
                          <div className="flex justify-between">
                            <span>{isZh ? "拟出具海运提单:" : "OBL draft status:"}</span>
                            <span className="text-green-400 font-bold">Generated</span>
                          </div>
                          <div className="flex justify-between">
                            <span>{isZh ? "拟申报 HTS Code:" : "HTS Code target:"}</span>
                            <span className="text-amber-400 font-mono">9406.90.0030</span>
                          </div>
                          <div className="flex justify-between">
                            <span>{isZh ? "保证信要求:" : "Bond Request:"}</span>
                            <span>Single Entry Bond (STB)</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2 mt-6">
                        <button className="w-full bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold text-xs py-2.5 rounded-xl flex items-center justify-center space-x-1.5 cursor-pointer transition-colors">
                          <FileText className="w-4 h-4" />
                          <span>{isZh ? "导出一站式报关询价包" : "Export Broker RFQ Package"}</span>
                        </button>
                        <span className="text-[10px] text-center block text-slate-400">{isZh ? "PDF格式 • 包含平面图及形式发票草稿" : "PDF bundle • Contains layouts & invoice drafts"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 8: LIVE SHIPMENT VOYAGE SIMULATOR */}
              {activeStep === 8 && (
                <div className="space-y-6" id="step-voyage-tracker">
                  <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                    <div>
                      <h2 className="font-sans font-bold text-slate-900 text-lg">
                        {isZh ? "第八阶段：横跨太平洋航线追踪与模拟 (Pacific Voyage Tracker)" : "Phase 8: Track Ocean Shipment (Visual Voyage Simulator)"}
                      </h2>
                      <p className="text-xs text-slate-400 mt-1">
                        {isZh 
                          ? "模拟集装箱货轮从上海洋山港出发，横跨太平洋，抵达美国指定入境港口的全流程可视化轨迹。" 
                          : "Simulate cargo container routing across the Pacific ocean to your selected discharge port."}
                      </p>
                    </div>
                    <span className="bg-indigo-50 text-indigo-600 font-bold text-xs px-2.5 py-1 rounded-full uppercase">
                      Step 8/9
                    </span>
                  </div>

                  <div className="space-y-8">
                    
                    {/* Visual Route Track */}
                    <div className="relative bg-slate-900 rounded-2xl p-6 text-white min-h-[14rem] overflow-hidden border border-slate-800 flex flex-col justify-between">
                      {/* Grid background */}
                      <div className="absolute inset-0 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:16px_16px] z-0" />
                      
                      {/* World map vectors or labels representation */}
                      <div className="relative z-10 flex justify-between text-xs text-slate-400 select-none">
                        <div className="text-left bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                          <strong className="text-white block font-black">{isZh ? "起始港：中国上海港" : "POL: Shanghai Seaport (CN)"}</strong>
                          <span className="text-[10px]">Yangshan Deepwater Port</span>
                        </div>

                        <div className="text-right bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                          <strong className="text-indigo-400 block font-black">{isZh ? `卸货港：${selectedPort.name_en}` : `POD: ${selectedPort.name_en}`}</strong>
                          <span className="text-[10px]">{selectedPort.region} • {selectedPort.oceanDays} days</span>
                        </div>
                      </div>

                      {/* Ship visual line */}
                      <div className="relative z-10 py-6">
                        <div className="w-full bg-slate-800 h-1.5 rounded-full relative">
                          {/* Sail line progress */}
                          <div 
                            className="bg-indigo-500 h-1.5 rounded-full absolute left-0 top-0 transition-all duration-300" 
                            style={{ width: `${voyageProgress}%` }}
                          />

                          {/* Cargo Ship icon moving along */}
                          <div 
                            className="absolute -top-3.5 -translate-x-1/2 flex flex-col items-center space-y-1 transition-all duration-300"
                            style={{ left: `${voyageProgress}%` }}
                          >
                            <Ship className="w-7 h-7 text-amber-400 fill-amber-400/20 stroke-2 drop-shadow-[0_0_8px_rgba(251,191,36,0.3)] animate-bounce" />
                            <span className="text-[9px] bg-slate-950 text-white font-bold font-mono px-1.5 py-0.5 rounded border border-slate-800 uppercase tracking-wide">
                              {voyageProgress < 100 ? `Vessel Sailing ${voyageProgress}%` : "Vessel Arrived!"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Timeline steps */}
                      <div className="relative z-10 grid grid-cols-5 gap-1 text-[10px] text-slate-500">
                        <div className={`text-left ${voyageProgress >= 10 ? "text-indigo-400 font-bold" : ""}`}>
                          <span>1. Container Booked</span>
                        </div>
                        <div className={`text-center ${voyageProgress >= 30 ? "text-indigo-400 font-bold" : ""}`}>
                          <span>2. Sail from China</span>
                        </div>
                        <div className={`text-center ${voyageProgress >= 60 ? "text-indigo-400 font-bold" : ""}`}>
                          <span>3. Mid-Pacific crossing</span>
                        </div>
                        <div className={`text-center ${voyageProgress >= 85 ? "text-indigo-400 font-bold" : ""}`}>
                          <span>4. US Customs Cleared</span>
                        </div>
                        <div className={`text-right ${voyageProgress >= 100 ? "text-green-400 font-bold" : ""}`}>
                          <span>5. Dispatched Inland</span>
                        </div>
                      </div>
                    </div>

                    {/* Simulation trigger / Status dashboard */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center text-xs text-slate-600">
                      <div className="space-y-3">
                        <h4 className="font-sans font-bold text-slate-800 text-sm">{isZh ? "国际集装箱货轮模拟控制器" : "Voyage Simulator Controller"}</h4>
                        <p className="leading-relaxed">
                          {isZh 
                            ? "点击按钮，模拟预制房屋集装箱在海上的实际航程状态。直观地了解您的模块住宅已经航行到哪个环节，何时触发海关保税单一申报及拖车预约。" 
                            : "Trigger the sailing simulation to preview shipping checkpoints, ocean transit speed, and inland dispatch timings."}
                        </p>

                        <div className="flex space-x-3 pt-2">
                          <button
                            onClick={() => {
                              setIsVesselSailing(true);
                              if (voyageProgress >= 100) setVoyageProgress(0);
                            }}
                            disabled={isVesselSailing}
                            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-xl flex items-center space-x-2 transition-colors cursor-pointer"
                          >
                            <RefreshCw className={`w-4 h-4 ${isVesselSailing ? "animate-spin" : ""}`} />
                            <span>{isZh ? "开始航行模拟" : "Simulate Pacific Transit"}</span>
                          </button>
                          
                          <button
                            onClick={() => {
                              setIsVesselSailing(false);
                              setVoyageProgress(20);
                            }}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-xl transition-colors cursor-pointer"
                          >
                            <span>{isZh ? "重置" : "Reset"}</span>
                          </button>
                        </div>
                      </div>

                      <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl space-y-2">
                        <span className="font-sans font-bold text-slate-800 text-xs block uppercase mb-1">{isZh ? "船只定位测算数据" : "Ship Position Coordinates"}</span>
                        <div className="space-y-1.5 font-mono text-[11px] text-slate-500 scale-95 origin-left">
                          <div className="flex justify-between">
                            <span>{isZh ? "承运货轮名称 (COSCO):" : "Vessel Name (COSCO):"}</span>
                            <span className="text-slate-800 font-bold">COSCO DEVELOPMENT V.088</span>
                          </div>
                          <div className="flex justify-between">
                            <span>{isZh ? "船只平均航速:" : "Avg Sailing Speed:"}</span>
                            <span className="text-slate-800">18.5 Knots</span>
                          </div>
                          <div className="flex justify-between">
                            <span>{isZh ? "当前GPS定位:" : "Current GPS Coordinates:"}</span>
                            <span className="text-slate-800">31.2304° N, 121.4737° E</span>
                          </div>
                          <div className="flex justify-between">
                            <span>{isZh ? "预估海关到货日期:" : "Est. Customs ETA:"}</span>
                            <span className="text-indigo-600 font-bold">2026-07-20</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 9: SITE PREP & LOCAL ASSEMBLY */}
              {activeStep === 9 && (
                <div className="space-y-6" id="step-site-assembly">
                  <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                    <div>
                      <h2 className="font-sans font-bold text-slate-900 text-lg">
                        {isZh ? "第九阶段：地基施工与吊车组装 (Site Prep & Assembly)" : "Phase 9: Foundation Site Prep & Crane Placement"}
                      </h2>
                      <p className="text-xs text-slate-400 mt-1">
                        {isZh 
                          ? "卡车运抵现场后，地基施工、给排水排污接口以及起重机吊装定位是最后合规合围的决定性工序。" 
                          : "Final instructions on foundation prep, heavy crane hiring, and utilities compliance connections."}
                      </p>
                    </div>
                    <span className="bg-indigo-50 text-indigo-600 font-bold text-xs px-2.5 py-1 rounded-full uppercase">
                      Step 9/9
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Concrete layout instructions */}
                    <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl space-y-4">
                      <div className="flex items-center space-x-2 text-indigo-900">
                        <Building2 className="w-4 h-4 text-indigo-600" />
                        <h3 className="font-sans font-black text-xs uppercase tracking-wide">{isZh ? "地基施工指南 (Concrete Foundation)" : "Concrete Foundation & Utilities"}</h3>
                      </div>

                      <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
                        <p>
                          {isZh 
                            ? "所有装配式结构不能直接放置在泥土上。买家必须在平板拖车抵达前，完成混凝土条形地基 (Piers Foundation) 或整体板式地基 (Slab Foundation)。" 
                            : "All permanent structures must sit on a concrete slab or engineered foundation piers, not raw soil."}
                        </p>
                        <p>
                          {isZh 
                            ? "1. **混凝土点式桩基**: 适合太空舱和集装箱，成本较低。由买家委托当地承包商按照厂家的 CAD 平面图定位地脚螺栓。" 
                            : "1. **Pier Foundations**: Ideal for space capsules and container pods. Low cost and highly adaptive to uneven yards."}
                        </p>
                        <p>
                          {isZh 
                            ? "2. **公用事业接入口 (UPC/NEC)**: 水、电、污水预留管线口必须预先铺设在地基中心，当吊装钢屋就位时，能直接对接，避免重复施工。" 
                            : "2. **Utility Stub-outs**: Ensure water inlets, electrical conduits, and sewer drains are strictly aligned with the factory floor plan before the concrete is poured."}
                        </p>
                      </div>
                    </div>

                    {/* Crane hiring rules */}
                    <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl space-y-4">
                      <div className="flex items-center space-x-2 text-indigo-900">
                        <Truck className="w-4 h-4 text-indigo-600" />
                        <h3 className="font-sans font-black text-xs uppercase tracking-wide">{isZh ? "吊车租赁与路障查勘 (Crane Hire)" : "Crane Rigging & Off-load Logistics"}</h3>
                      </div>

                      <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
                        <p>
                          {isZh 
                            ? "预制房屋一般重达 5-10 吨。必须在卡车送达当天聘请专业移动起重机 (Mobile Crane) 进行吊装定位。" 
                            : "Prefab houses usually weigh between 10,000 to 20,000 lbs. You must coordinate a mobile crane for the flatbed drop-off day."}
                        </p>
                        <p>
                          {isZh 
                            ? "1. **起重机规格建议**: 正常后院 ADU 吊装一般需要 **50 吨至 100 吨级起重机**，以保证悬臂跨度达到安全卸货半径。" 
                            : "1. **Crane Capacity**: A **50-ton to 100-ton mobile crane** is standard for yard ADU positioning, accommodating safe reach radius margins."}
                        </p>
                        <p>
                          {isZh 
                            ? "2. **工地进出通路审核**: 低平板卡车长达 12-15 米，确保大货车能直接驶入吊装点。现场上方不能有高压电线、大树树枝遮挡。" 
                            : "2. **Access & Obstacles**: Check your entry clearance for 40ft long flatbeds. Ensure overhead utility power lines, branches, or soft soil do not block the crane pads."}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Flow footer buttons */}
                  <div className="border-t border-slate-100 pt-5 flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-medium">
                      {isZh ? "完成以上九步，您的中美跨境集成房屋采购即告大功告成！" : "With these 9 phases complete, your cross-border prefab home is fully operational!"}
                    </span>
                    <button
                      onClick={() => setActiveStep(1)}
                      className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 py-2 rounded-xl flex items-center space-x-1 transition-colors cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>{isZh ? "从第一步重新查看" : "Restart Import Wizard"}</span>
                    </button>
                  </div>
                </div>
              )}

            </motion.div>
          </AnimatePresence>
        </div>

      </div>

    </div>
  );
}
