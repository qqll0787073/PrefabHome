import React, { useState, useEffect } from "react";
import { ManufacturerProfile, Product, AdminLog, Language } from "../types";
import { getTranslation } from "../utils/translation";
import { getCrawlerDatabase } from "../data/crawler_database";
import { 
  ShieldCheck, UserCheck, Eye, CheckCircle2, XCircle, FileClock, 
  LayoutList, Search, Mail, MailCheck, Database, Plus, Edit, Trash, 
  FileSpreadsheet, Check, Send, Sparkles, RefreshCw, Layers, CheckSquare, 
  Globe, AlertTriangle, ArrowUpRight, SlidersHorizontal, ArrowLeftRight, Save
} from "lucide-react";

interface AdminDashboardProps {
  language: Language;
  manufacturers: ManufacturerProfile[];
  products: Product[];
  adminLogs: AdminLog[];
  onApproveManufacturer: (mfgId: string) => void;
  onRejectManufacturer: (mfgId: string) => void;
  onUpdateManufacturers?: (mfgs: ManufacturerProfile[]) => void;
  onUpdateProducts?: (prods: Product[]) => void;
  onAddAdminLog?: (action: string, details: string) => void;
}

export default function AdminDashboard({
  language,
  manufacturers,
  products,
  adminLogs,
  onApproveManufacturer,
  onRejectManufacturer,
  onUpdateManufacturers,
  onUpdateProducts,
  onAddAdminLog
}: AdminDashboardProps) {
  const isZh = language === "zh";
  const [activeTab, setActiveTab] = useState<"mfg-review" | "mfg-database" | "prod-review" | "audit-logs">("mfg-database");

  // CRM specific state
  const [dbSubTab, setDbSubTab] = useState<"active-crm" | "crawler-index">("active-crm");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [provinceFilter, setProvinceFilter] = useState<string>("ALL");
  const [selectedMfgId, setSelectedMfgId] = useState<string | null>(manufacturers[0]?.id || null);
  const [workspaceTab, setWorkspaceTab] = useState<"profile" | "pim" | "outreach">("profile");

  // Sourcing Crawler state
  const [crawlerQuery, setCrawlerQuery] = useState("");
  const [crawlerProvinceFilter, setCrawlerProvinceFilter] = useState<string>("ALL");
  const [crawlerDb, setCrawlerDb] = useState<ManufacturerProfile[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // AI Sourcing Outreach state
  const [aiStep, setAiStep] = useState<"idle" | "drafting" | "drafted" | "sending" | "sent" | "replying" | "replied">("idle");
  const [outreachDraft, setOutreachDraft] = useState("");
  const [outreachReply, setOutreachReply] = useState("");
  const [extractedModels, setExtractedModels] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");
  const [progressPercent, setProgressPercent] = useState(0);

  // Form states for adding/editing models manually in PIM
  const [isAddingModel, setIsAddingModel] = useState(false);
  const [newModel, setNewModel] = useState({
    name: "",
    modelNumber: "",
    category: "Tiny House",
    price: 18000,
    size: "8.5m x 2.4m x 2.8m",
    area: 220,
    description: ""
  });

  // Load Crawler Database
  useEffect(() => {
    setCrawlerDb(getCrawlerDatabase());
  }, []);

  // Sync selected mfg when manufacturers array changes or on initial load
  useEffect(() => {
    if (manufacturers.length > 0 && (!selectedMfgId || !manufacturers.some(m => m.id === selectedMfgId))) {
      setSelectedMfgId(manufacturers[0].id);
    }
  }, [manufacturers, selectedMfgId]);

  const pendingMFGs = manufacturers.filter(m => m.status === "pending");
  const approvedMFGs = manufacturers.filter(m => m.status === "approved");

  // Get current active selected manufacturer profile
  const selectedMfg = manufacturers.find(m => m.id === selectedMfgId);

  // Filter Active CRM
  const filteredActiveMfgs = manufacturers.filter(m => {
    const matchesSearch = 
      m.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.companyNameCn && m.companyNameCn.includes(searchQuery)) ||
      m.contactPerson.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.email && m.email.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesStatus = statusFilter === "ALL" || m.contactStatus === statusFilter;
    const matchesProvince = provinceFilter === "ALL" || m.province === provinceFilter;

    return matchesSearch && matchesStatus && matchesProvince;
  });

  // Filter Crawled Database
  const filteredCrawlerDb = crawlerDb.filter(m => {
    const matchesSearch = 
      m.companyName.toLowerCase().includes(crawlerQuery.toLowerCase()) ||
      (m.companyNameCn && m.companyNameCn.includes(crawlerQuery)) ||
      m.contactPerson.toLowerCase().includes(crawlerQuery.toLowerCase()) ||
      (m.email && m.email.toLowerCase().includes(crawlerQuery.toLowerCase()));
    
    const matchesProvince = crawlerProvinceFilter === "ALL" || m.province === crawlerProvinceFilter;

    // Do not show manufacturers that are already imported in active CRM
    const isAlreadyImported = manufacturers.some(active => active.companyName === m.companyName);

    return matchesSearch && matchesProvince && !isAlreadyImported;
  });

  // Pagination for crawler
  const totalCrawlerItems = filteredCrawlerDb.length;
  const totalPages = Math.ceil(totalCrawlerItems / itemsPerPage);
  const paginatedCrawlerDb = filteredCrawlerDb.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Active Provinces list for filters
  const activeProvinces = Array.from(new Set(manufacturers.map(m => m.province).filter(Boolean))) as string[];
  const crawlerProvinces = Array.from(new Set(crawlerDb.map(m => m.province).filter(Boolean))) as string[];

  // Import manufacturer from Crawler to Active CRM
  const handleImportManufacturer = (mfg: ManufacturerProfile) => {
    if (!onUpdateManufacturers) return;

    const newImport: ManufacturerProfile = {
      ...mfg,
      id: `mfg_imported_${Date.now()}`,
      status: "approved",
      contactStatus: "Not Contacted",
      factoryPhotos: ["https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&q=80&w=600"]
    };

    onUpdateManufacturers([...manufacturers, newImport]);
    setSelectedMfgId(newImport.id);
    setDbSubTab("active-crm");

    if (onAddAdminLog) {
      onAddAdminLog(
        isZh ? "导入源头厂家" : "Imported Chinese Manufacturer",
        isZh 
          ? `成功从集成索引库导入厂家: ${mfg.companyName} (${mfg.companyNameCn || ""})` 
          : `Successfully imported ${mfg.companyName} from master database to live Sourcing CRM.`
      );
    }
    alert(isZh ? `成功导入厂家: ${mfg.companyName}` : `Successfully imported: ${mfg.companyName}`);
  };

  // Batch Import Top Verified Manufacturers
  const handleBatchImport = () => {
    if (!onUpdateManufacturers) return;

    const topMfgs = crawlerDb
      .filter(m => m.verified && !manufacturers.some(active => active.companyName === m.companyName))
      .slice(0, 15);

    if (topMfgs.length === 0) {
      alert(isZh ? "当前无更多可导入的高质量认证厂家。" : "No new verified manufacturers to import.");
      return;
    }

    const imported: ManufacturerProfile[] = topMfgs.map((m, idx) => ({
      ...m,
      id: `mfg_batch_${Date.now()}_${idx}`,
      status: "approved",
      contactStatus: "Not Contacted",
      factoryPhotos: ["https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&q=80&w=600"]
    }));

    onUpdateManufacturers([...manufacturers, ...imported]);
    
    if (onAddAdminLog) {
      onAddAdminLog(
        isZh ? "批量导入源头厂家" : "Batch Sourcing CRM Import",
        isZh 
          ? `成功批量从中国海关目录和行业协会索引库中导入 ${imported.length} 家认证精工制造厂。` 
          : `Batch imported ${imported.length} verified prefab manufacturers directly into active CRM.`
      );
    }

    alert(isZh ? `成功批量导入 ${imported.length} 家认证制造厂！` : `Successfully imported ${imported.length} factories into CRM!`);
  };

  // Edit current active manufacturer parameters
  const handleSaveMfgProfile = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedMfg || !onUpdateManufacturers) return;

    const formData = new FormData(e.currentTarget);
    const updated: ManufacturerProfile = {
      ...selectedMfg,
      companyName: formData.get("companyName") as string,
      companyNameCn: formData.get("companyNameCn") as string,
      contactPerson: formData.get("contactPerson") as string,
      title: formData.get("title") as string,
      email: formData.get("email") as string,
      phone: formData.get("phone") as string,
      mobile: formData.get("mobile") as string,
      whatsapp: formData.get("whatsapp") as string,
      wechat: formData.get("wechat") as string,
      website: formData.get("website") as string,
      province: formData.get("province") as string,
      city: formData.get("city") as string,
      address: formData.get("address") as string,
      notes: formData.get("notes") as string,
      annualCapacity: formData.get("annualCapacity") as string,
      employees: Number(formData.get("employees")),
      factoryAreaSqm: Number(formData.get("factoryAreaSqm")),
      oem: formData.get("oem") === "true",
      odm: formData.get("odm") === "true",
      verified: formData.get("verified") === "true",
      contactStatus: formData.get("contactStatus") as any,
    };

    const updatedList = manufacturers.map(m => m.id === selectedMfg.id ? updated : m);
    onUpdateManufacturers(updatedList);

    if (onAddAdminLog) {
      onAddAdminLog(
        isZh ? "修改厂家CRM属性" : "Updated Manufacturer Profile",
        isZh 
          ? `修改了厂家 [${updated.companyName}] 的联系人、微信及CRM跟进状态 [${updated.contactStatus}]。` 
          : `Modified contact information and CRM contact status [${updated.contactStatus}] for [${updated.companyName}].`
      );
    }

    alert(isZh ? "厂家资料及CRM状态已更新！" : "Manufacturer CRM parameters updated successfully!");
  };

  // Toggle Preferred Status
  const handleTogglePreferred = () => {
    if (!selectedMfg || !onUpdateManufacturers) return;
    const updated: ManufacturerProfile = {
      ...selectedMfg,
      preferredSupplier: !selectedMfg.preferredSupplier
    };
    onUpdateManufacturers(manufacturers.map(m => m.id === selectedMfg.id ? updated : m));
    
    if (onAddAdminLog) {
      onAddAdminLog(
        updated.preferredSupplier ? (isZh ? "设为优选供应商" : "Set as Preferred Supplier") : (isZh ? "取消优选供应商" : "Removed Preferred Supplier"),
        `[${selectedMfg.companyName}] has been ${updated.preferredSupplier ? "marked" : "unmarked"} as preferred.`
      );
    }
  };

  // PIM: Add a standard house model to this manufacturer
  const handleAddSpecModel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMfg || !onUpdateProducts || !onUpdateManufacturers) return;

    const newProdId = `prod_pim_${Date.now()}`;
    const productItem: Product = {
      id: newProdId,
      name: newModel.name,
      modelNumber: newModel.modelNumber || `M-${Date.now().toString().slice(-4)}`,
      category: newModel.category,
      manufacturerId: selectedMfg.id,
      manufacturerName: selectedMfg.companyName,
      price: newModel.price,
      size: newModel.size,
      area: newModel.area,
      bedrooms: 1,
      bathrooms: 1,
      hasKitchen: true,
      productionTime: 35,
      shippingAvailability: "Global",
      image: "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&q=80&w=600",
      imageGallery: ["https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&q=80&w=600"],
      floorPlan: "Standard modular layout with pre-engineered service hooks",
      description: newModel.description || `${newModel.name} configured directly into active PIM catalog by administrator.`,
      structureMaterial: isZh ? "轻钢骨架或Q355重钢" : "Light-gauge steel or Q355 galvanized heavy steel subframes",
      wallMaterial: "Polyurethane foamed-in-place (PU) or rockwool core insulation panels",
      roofMaterial: "Color steel tile sandwich thermal ceiling",
      windowType: "Double Glazed Tempered Glass Windows",
      insulation: isZh ? "聚氨酯双重发泡层 100mm" : "Polyurethane dual-layer insulation 100mm",
      electricalSystem: "NEC standard pre-installed pre-wiring (110V/220V dual voltage), standard US distribution breaker box",
      plumbingSystem: "UPC compliance pre-configured water drainage pipe, 美标 3/4\" NPT brass connection inlet",
      weight: 4800,
      requiredContainers: "1x 40HQ",
      isCustomizable: true,
      isSuitableForOffGrid: true,
      isSuitableForAdu: true,
      warranty: "5 Years",
      certifications: selectedMfg.certifications || ["ISO9001", "CE"]
    };

    onUpdateProducts([...products, productItem]);
    setIsAddingModel(false);
    setNewModel({
      name: "",
      modelNumber: "",
      category: "Tiny House",
      price: 18000,
      size: "8.5m x 2.4m x 2.8m",
      area: 220,
      description: ""
    });

    if (onAddAdminLog) {
      onAddAdminLog(
        isZh ? "上架新房型/PIM模型" : "Created PIM Spec Model",
        isZh 
          ? `在厂家 [${selectedMfg.companyName}] 旗下录入并上架了新房型: [${productItem.name}] (型号: ${productItem.modelNumber}, FOB $${productItem.price.toLocaleString()})` 
          : `Recorded and published new modular model [${productItem.name}] under manufacturer [${selectedMfg.companyName}] (FOB $${productItem.price.toLocaleString()}).`
      );
    }
  };

  // Delete product model from PIM
  const handleDeleteModel = (productId: string) => {
    if (!onUpdateProducts) return;
    const targetProduct = products.find(p => p.id === productId);
    onUpdateProducts(products.filter(p => p.id !== productId));
    
    if (onAddAdminLog && targetProduct) {
      onAddAdminLog(
        isZh ? "下架房型模型" : "Removed Model from PIM",
        `Removed model [${targetProduct.name}] from manufacturer [${targetProduct.manufacturerName}]'s PIM database.`
      );
    }
  };

  // ----------------------------------------------------
  // AI Outreach Automation Core Methods
  // ----------------------------------------------------

  // Call the Gemini API to draft the inquiry email
  const handleGenerateOutreachEmail = async () => {
    if (!selectedMfg) return;
    setAiStep("drafting");
    setOutreachDraft("");

    try {
      const response = await fetch("/api/crm/generate-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: selectedMfg.companyName,
          contactPerson: selectedMfg.contactPerson,
          province: selectedMfg.province,
          city: selectedMfg.city,
          products: selectedMfg.products || ["Expandable Container House"]
        })
      });

      const data = await response.json();
      if (data.draft) {
        setOutreachDraft(data.draft);
        setAiStep("drafted");
      } else {
        throw new Error(data.error || "Failed to generate draft");
      }
    } catch (error: any) {
      console.error(error);
      setAiStep("idle");
      alert("Error calling Gemini API: " + error.message);
    }
  };

  // Simulate routing and sending the email
  const handleSendOutreachEmail = () => {
    if (!selectedMfg || !onUpdateManufacturers) return;
    setAiStep("sending");
    setProgressPercent(0);
    setProgressMsg(isZh ? "正在解析厂家 MX 记录..." : "Resolving supplier MX mail servers...");

    const intervals = [
      { p: 15, m: isZh ? "正在配置 SMTP 握手安全证书 (STARTTLS)..." : "Securing SMTP TLS handshake..." },
      { p: 40, m: isZh ? "正在将定制开发函推入邮件发件池..." : "Queuing customized inquiry..." },
      { p: 70, m: isZh ? "正在通过安全网关发送开发信..." : "Streaming data via enterprise mail relay..." },
      { p: 100, m: isZh ? "邮件已投递！等待中国邮件系统回执..." : "Delivered successfully! Awaiting daemon tracking confirmation..." }
    ];

    let index = 0;
    const timer = setInterval(() => {
      if (index < intervals.length) {
        setProgressPercent(intervals[index].p);
        setProgressMsg(intervals[index].m);
        index++;
      } else {
        clearInterval(timer);
        
        // Update contactStatus
        const updated: ManufacturerProfile = {
          ...selectedMfg,
          contactStatus: "Contacted",
          lastEmailSent: new Date().toISOString().slice(0, 10),
          firstContactDate: selectedMfg.firstContactDate || new Date().toISOString().slice(0, 10),
        };
        onUpdateManufacturers(manufacturers.map(m => m.id === selectedMfg.id ? updated : m));

        setAiStep("sent");
        if (onAddAdminLog) {
          onAddAdminLog(
            isZh ? "发送AI开发信" : "Dispatched AI Sourcing Outreach",
            `Successfully drafted and dispatched professional developers inquiry with code check demands to ${selectedMfg.contactPerson} (${selectedMfg.email}).`
          );
        }
      }
    }, 800);
  };

  // Trigger Gemini-powered Manufacturer Auto-Reply Simulation
  const handleListenForReply = async () => {
    if (!selectedMfg) return;
    setAiStep("replying");
    setOutreachReply("");
    setExtractedModels([]);

    try {
      const response = await fetch("/api/crm/generate-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: selectedMfg.companyName,
          contactPerson: selectedMfg.contactPerson,
          province: selectedMfg.province,
          city: selectedMfg.city,
          products: selectedMfg.products || ["ADU Unit"]
        })
      });

      const data = await response.json();
      if (data.replyText) {
        setOutreachReply(data.replyText);
        
        // Parse the hidden JSON block inside the markdown text
        const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
        const match = data.replyText.match(jsonRegex);
        if (match && match[1]) {
          try {
            const models = JSON.parse(match[1]);
            setExtractedModels(models);
          } catch (e) {
            console.error("Failed to parse extracted models JSON:", e);
          }
        }
        
        setAiStep("replied");
      } else {
        throw new Error("No response from simulated mail gateway");
      }
    } catch (error: any) {
      console.error(error);
      setAiStep("sent");
      alert("Error getting auto-reply: " + error.message);
    }
  };

  // Write Extracted Models to main Products state (Commit Sourcing Data to PIM)
  const handleCommitSourcingData = () => {
    if (!selectedMfg || !onUpdateManufacturers || !onUpdateProducts || extractedModels.length === 0) return;

    // 1. Add extracted models to active Products state
    const newProductsList = [...products];
    
    extractedModels.forEach((model, index) => {
      // Check if product with modelNumber already exists
      const exists = products.some(p => p.modelNumber === model.modelNumber);
      if (!exists) {
        newProductsList.push({
          id: `prod_extracted_${Date.now()}_${index}`,
          name: model.name,
          modelNumber: model.modelNumber,
          category: model.category || "Tiny House",
          manufacturerId: selectedMfg.id,
          manufacturerName: selectedMfg.companyName,
          price: model.price,
          size: model.size || "8.5m x 2.25m x 2.6m",
          area: model.area || 205,
          bedrooms: 1,
          bathrooms: 1,
          hasKitchen: true,
          productionTime: 30,
          shippingAvailability: "Global",
          image: index === 0 
              ? "https://images.unsplash.com/photo-1513828722001-c226f1644b95?auto=format&fit=crop&q=80&w=600" 
              : "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&q=80&w=600",
          imageGallery: [
            index === 0 
              ? "https://images.unsplash.com/photo-1513828722001-c226f1644b95?auto=format&fit=crop&q=80&w=600" 
              : "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&q=80&w=600"
          ],
          floorPlan: "Standard pre-integrated floor plan",
          description: model.description || `${model.name} dynamically extracted and indexed into active catalog by Gemini AI Sourcing Agent.`,
          structureMaterial: isZh ? "高强度热浸镀锌钢底盘" : "High tensile hot-dip galvanized chassis",
          wallMaterial: "Aviation aluminum composite board shell with PU foam",
          roofMaterial: "Weatherproof thermal protection roof panels",
          windowType: "Vacuum Triple-glazed Privacy Safety Glass",
          insulation: isZh ? "发泡聚氨酯 100mm" : "Polyurethane dual-layer high density insulation foam 100mm",
          electricalSystem: "NEC US pre-wired system, Standard 110V/220V, US distribution box with GFI",
          plumbingSystem: "Standard 3/4 inch NPT brass connections, UPC-compliant plumbing paths",
          weight: 5500,
          requiredContainers: "1x 40HQ",
          isCustomizable: true,
          isSuitableForOffGrid: true,
          isSuitableForAdu: true,
          warranty: "10 Years",
          certifications: selectedMfg.certifications || ["ISO9001", "CE", "CSA"]
        });
      }
    });

    onUpdateProducts(newProductsList);

    // 2. Update CRM state for manufacturer
    const updated: ManufacturerProfile = {
      ...selectedMfg,
      contactStatus: "Replied",
      responseReceived: true,
      responseTime: "2h",
      productCatalogReceived: true,
      priceListReceived: true,
      photosReceived: true,
      videosReceived: true,
      cadReceived: true,
      lastContactDate: new Date().toISOString().slice(0, 10),
    };

    onUpdateManufacturers(manufacturers.map(m => m.id === selectedMfg.id ? updated : m));
    setAiStep("idle");
    setOutreachReply("");
    setExtractedModels([]);

    if (onAddAdminLog) {
      onAddAdminLog(
        isZh ? "AI解析并导入PIM规格" : "AI Sourcing Catalog Extracted",
        isZh 
          ? `成功运用 Gemini 智能提取算法，从 [${selectedMfg.companyName}] 的报价回执中解析出 ${extractedModels.length} 个美标出口房型，并一键导入平台 PIM 数据库。` 
          : `Extracted ${extractedModels.length} modular structures from ${selectedMfg.companyName}'s quotation reply and committed to active PIM.`
      );
    }

    alert(isZh 
      ? `🎉 成功解析并导入 ${extractedModels.length} 个房型到 PIM 产品目录中！该厂家的 CRM 状态已更新为“已回复（Replied）”，并标记了完整的产品图纸与报价单。` 
      : `🎉 Dynamic Sourcing Succeeded! Created ${extractedModels.length} model definitions inside active PIM under ${selectedMfg.companyName}.`
    );
  };


  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      
      {/* Admin Title Board */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row justify-between items-start md:items-center shadow-lg border border-slate-800">
        <div className="space-y-1.5">
          <span className="text-[10px] font-bold text-amber-400 bg-white/10 px-2.5 py-0.5 rounded border border-white/10 uppercase tracking-widest inline-block">
            {isZh ? "超级管理员授权" : "ROOT ACCESS GRANTED"}
          </span>
          <h2 className="font-sans font-black text-2xl tracking-tight">
            {getTranslation(language, "adminConsole")}
          </h2>
          <p className="text-xs text-slate-400">
            {isZh ? "审批跨境出厂执照、核查房屋结构标准、审查中英对谈合规性、审计平台全链流水记录。" : "Verify manufacturing licenses, technical floor plans, and monitor cross-border dispute logs."}
          </p>
        </div>
        
        {/* Statistics badge widgets */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 md:mt-0 text-xs text-center">
          <div className="bg-white/10 px-3 py-2 rounded-xl border border-white/15 min-w-[100px]">
            <span className="text-slate-400 block text-[9px] uppercase font-bold">{isZh ? "待审批厂家" : "Pending License"}</span>
            <strong className="text-base text-amber-400 font-black">{pendingMFGs.length}</strong>
          </div>
          <div className="bg-white/10 px-3 py-2 rounded-xl border border-white/15 min-w-[100px]">
            <span className="text-slate-400 block text-[9px] uppercase font-bold">{isZh ? "CRM 供应商" : "CRM Suppliers"}</span>
            <strong className="text-base text-white font-black">{approvedMFGs.length}</strong>
          </div>
          <div className="bg-white/10 px-3 py-2 rounded-xl border border-white/15 min-w-[100px]">
            <span className="text-slate-400 block text-[9px] uppercase font-bold">{isZh ? "PIM 房型规范" : "PIM Models"}</span>
            <strong className="text-base text-white font-black">{products.length}</strong>
          </div>
          <div className="bg-white/10 px-3 py-2 rounded-xl border border-white/15 min-w-[100px]">
            <span className="text-slate-400 block text-[9px] uppercase font-bold">{isZh ? "优选供应商" : "Preferred"}</span>
            <strong className="text-base text-emerald-400 font-black">{approvedMFGs.filter(m => m.preferredSupplier).length}</strong>
          </div>
        </div>
      </div>

      {/* Internal admin tabs */}
      <div className="flex border-b border-slate-100 overflow-x-auto space-x-1.5 scrollbar-thin">
        {[
          { key: "mfg-database", label: isZh ? "CRM 厂家 & PIM 库" : "Manufacturer CRM & PIM Database", count: 0, icon: Database },
          { key: "mfg-review", label: getTranslation(language, "manufacturersApproved"), count: pendingMFGs.length, icon: UserCheck },
          { key: "prod-review", label: getTranslation(language, "productsReviewed"), count: 0, icon: LayoutList },
          { key: "audit-logs", label: getTranslation(language, "platformAudit"), count: adminLogs.length, icon: FileClock }
        ].map((sub) => {
          const Icon = sub.icon;
          return (
            <button
              key={sub.key}
              onClick={() => setActiveTab(sub.key as any)}
              className={`flex items-center space-x-1.5 px-5 py-3 rounded-t-xl text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
                activeTab === sub.key
                  ? "border-slate-900 text-slate-900 bg-white font-black"
                  : "border-transparent text-slate-500 hover:text-slate-900"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{sub.label}</span>
              {sub.count > 0 && (
                <span className="bg-amber-500 text-slate-950 font-black text-[10px] px-1.5 py-0.5 rounded-full ml-1">
                  {sub.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* PORTAL VIEW 1: MANUFACTURER CRM & PRODUCT SPEC PIM DATABASE */}
      {activeTab === "mfg-database" && (
        <div className="space-y-6">
          
          {/* Sub tab switcher: Active CRM vs Crawled Supplier Database */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-50 p-1.5 rounded-2xl gap-3">
            <div className="flex space-x-1 w-full sm:w-auto">
              <button
                onClick={() => setDbSubTab("active-crm")}
                className={`flex-1 sm:flex-none flex items-center justify-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  dbSubTab === "active-crm"
                    ? "bg-white text-slate-900 shadow-3xs"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <Database className="w-3.5 h-3.5" />
                <span>{isZh ? "CRM 活跃供应商名录" : "Active CRM Supplier Sourcing"} ({approvedMFGs.length})</span>
              </button>
              
              <button
                onClick={() => setDbSubTab("crawler-index")}
                className={`flex-1 sm:flex-none flex items-center justify-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  dbSubTab === "crawler-index"
                    ? "bg-white text-slate-900 shadow-3xs"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>{isZh ? "中国厂家检索大底表" : "Crawled Supplier Index"} ({filteredCrawlerDb.length}+)</span>
              </button>
            </div>

            {dbSubTab === "crawler-index" && (
              <button
                onClick={handleBatchImport}
                className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-amber-400 text-xs font-black px-4 py-2 rounded-xl flex items-center justify-center space-x-1 transition-colors border border-slate-800"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isZh ? "一键批量录入优质厂家 (15家)" : "Batch Import Verified Factories"}</span>
              </button>
            )}
          </div>

          {/* MAIN CRM LAYOUT */}
          {dbSubTab === "active-crm" ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* Left Column: Sourcing list with filters */}
              <div className="lg:col-span-4 bg-white rounded-3xl border border-slate-100 p-5 shadow-2xs space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <h3 className="font-sans font-bold text-slate-900 text-xs uppercase tracking-wide">
                    {isZh ? "商洽供应商筛选" : "Sourcing Filters"}
                  </h3>
                  <span className="text-[10px] text-slate-400 font-bold font-mono">
                    {filteredActiveMfgs.length} MATCHING
                  </span>
                </div>

                <div className="space-y-3">
                  {/* Search bar */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder={isZh ? "搜索厂家、省份、微信、联系人..." : "Search company, email, WeChat..."}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-slate-50 text-slate-800 placeholder-slate-400 rounded-xl pl-9 pr-3 py-2 text-xs outline-hidden border border-slate-100 focus:border-slate-300 focus:bg-white"
                    />
                  </div>

                  {/* Province and Status Selectors */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-slate-400 block">{isZh ? "省份筛选" : "Province"}</label>
                      <select
                        value={provinceFilter}
                        onChange={(e) => setProvinceFilter(e.target.value)}
                        className="w-full bg-slate-50 text-slate-700 rounded-lg p-1.5 text-xs outline-hidden border border-slate-100"
                      >
                        <option value="ALL">{isZh ? "全部省份" : "All Provinces"}</option>
                        {activeProvinces.map(prov => (
                          <option key={prov} value={prov}>{prov}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-slate-400 block">{isZh ? "商洽状态" : "CRM Status"}</label>
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="w-full bg-slate-50 text-slate-700 rounded-lg p-1.5 text-xs outline-hidden border border-slate-100"
                      >
                        <option value="ALL">{isZh ? "全部状态" : "All Status"}</option>
                        <option value="Not Contacted">{isZh ? "未联系" : "Not Contacted"}</option>
                        <option value="Contacted">{isZh ? "已联系" : "Contacted"}</option>
                        <option value="Replied">{isZh ? "已回复报价" : "Replied"}</option>
                        <option value="Follow-up">{isZh ? "深度跟进" : "Follow-up"}</option>
                        <option value="Active">{isZh ? "活跃交易" : "Active"}</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Sourcing Supplier List */}
                <div className="space-y-2 overflow-y-auto max-h-[500px] pr-1 scrollbar-thin">
                  {filteredActiveMfgs.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-[11px]">
                      {isZh ? "暂无匹配的商洽厂家。" : "No suppliers found matching current filters."}
                    </div>
                  ) : (
                    filteredActiveMfgs.map((m) => {
                      const isSelected = selectedMfgId === m.id;
                      const hasCatalog = m.productCatalogReceived;
                      const hasPrice = m.priceListReceived;
                      
                      let statusBadge = "";
                      switch (m.contactStatus) {
                        case "Active": statusBadge = "bg-emerald-100 text-emerald-800 border-emerald-200"; break;
                        case "Replied": statusBadge = "bg-amber-100 text-amber-800 border-amber-200"; break;
                        case "Contacted": statusBadge = "bg-blue-100 text-blue-800 border-blue-200"; break;
                        case "Follow-up": statusBadge = "bg-purple-100 text-purple-800 border-purple-200"; break;
                        default: statusBadge = "bg-slate-100 text-slate-600 border-slate-200";
                      }

                      return (
                        <div
                          key={m.id}
                          onClick={() => {
                            setSelectedMfgId(m.id);
                            setAiStep("idle"); // reset outreach flow
                          }}
                          className={`p-3.5 rounded-2xl border text-xs cursor-pointer transition-all ${
                            isSelected 
                              ? "bg-slate-900 text-white border-slate-950 shadow-md" 
                              : "bg-slate-50 hover:bg-slate-100 border-slate-100 text-slate-700"
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-bold line-clamp-1">{m.companyName}</h4>
                              <p className={`text-[10px] mt-0.5 ${isSelected ? "text-slate-300" : "text-slate-400"}`}>
                                {m.companyNameCn || ""}
                              </p>
                            </div>
                            {m.preferredSupplier && (
                              <span className="bg-amber-400 text-slate-900 font-bold px-1.5 py-0.5 rounded text-[8px]">
                                PREFERRED
                              </span>
                            )}
                          </div>

                          <div className="flex justify-between items-center mt-3 pt-2.5 border-t border-dashed border-slate-200/20">
                            <span className="text-[10px] text-slate-400 block">{m.city || m.province}, China</span>
                            <div className="flex items-center space-x-1.5">
                              {/* Catalog Indicators */}
                              <div className="flex space-x-0.5 text-[9px] font-bold">
                                <span className={`px-1 rounded-sm ${hasCatalog ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-200 text-slate-400"}`}>CAT</span>
                                <span className={`px-1 rounded-sm ${hasPrice ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-200 text-slate-400"}`}>PRC</span>
                              </div>
                              <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full border ${statusBadge}`}>
                                {m.contactStatus || "Not Contacted"}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Right Column: Supplier CRM and PIM Workspace */}
              <div className="lg:col-span-8 bg-white rounded-3xl border border-slate-100 p-6 shadow-2xs space-y-6">
                {selectedMfg ? (
                  <>
                    {/* Workspace Header Panel */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-100">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="bg-slate-900 text-white font-mono text-[9px] px-2 py-0.5 rounded uppercase tracking-wider">
                            ACTIVE CRM SUPPLIER
                          </span>
                          {selectedMfg.verified && (
                            <span className="bg-emerald-100 text-emerald-700 font-bold text-[9px] px-2 py-0.5 rounded-full border border-emerald-200">
                              Verified Factory
                            </span>
                          )}
                        </div>
                        <h2 className="font-sans font-black text-slate-900 text-lg mt-1">{selectedMfg.companyName}</h2>
                        <p className="text-xs text-slate-400">{selectedMfg.companyNameCn || ""}</p>
                      </div>

                      <div className="flex space-x-2 shrink-0">
                        <button
                          onClick={handleTogglePreferred}
                          className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors flex items-center space-x-1 ${
                            selectedMfg.preferredSupplier
                              ? "bg-amber-100 border-amber-200 text-amber-800"
                              : "bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                          <span>{selectedMfg.preferredSupplier ? (isZh ? "取消优选" : "Preferred") : (isZh ? "设为优选" : "Mark Preferred")}</span>
                        </button>
                      </div>
                    </div>

                    {/* Workspace Tab bar */}
                    <div className="flex border-b border-slate-100 space-x-1.5 text-xs">
                      {[
                        { key: "profile", label: isZh ? "CRM 联系方式 & 厂情记录" : "Profile & CRM", icon: UserCheck },
                        { key: "pim", label: isZh ? "PIM 房型型号管理" : "PIM Models Directory", icon: Layers },
                        { key: "outreach", label: isZh ? "AI 开发信与商洽跟进" : "AI Sourcing Outreach", icon: Sparkles }
                      ].map((sub) => {
                        const Icon = sub.icon;
                        const active = workspaceTab === sub.key;
                        return (
                          <button
                            key={sub.key}
                            onClick={() => setWorkspaceTab(sub.key as any)}
                            className={`flex items-center space-x-1.5 px-4 py-2.5 rounded-t-xl font-bold border-b-2 transition-all ${
                              active
                                ? "border-slate-950 text-slate-950 bg-slate-50/50"
                                : "border-transparent text-slate-400 hover:text-slate-900"
                            }`}
                          >
                            <Icon className="w-3.5 h-3.5" />
                            <span>{sub.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* WORKSPACE TAB 1: PROFILE & CRM FORM */}
                    {workspaceTab === "profile" && (
                      <form onSubmit={handleSaveMfgProfile} className="space-y-4 text-xs">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          
                          {/* Sourcing and Status */}
                          <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 space-y-3">
                            <h4 className="font-bold text-slate-800 pb-1 border-b border-slate-100">{isZh ? "CRM 业务开发状态" : "CRM Lead Sourcing Details"}</h4>
                            
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 block">{isZh ? "跟进状态" : "Contact Status"}</label>
                                <select
                                  name="contactStatus"
                                  defaultValue={selectedMfg.contactStatus || "Not Contacted"}
                                  className="w-full bg-white text-slate-800 rounded-lg p-1.5 border border-slate-200"
                                >
                                  <option value="Not Contacted">Not Contacted</option>
                                  <option value="Contacted">Contacted</option>
                                  <option value="Replied">Replied</option>
                                  <option value="Follow-up">Follow-up</option>
                                  <option value="Active">Active</option>
                                  <option value="Inactive">Inactive</option>
                                </select>
                              </div>

                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 block">{isZh ? "信誉评级" : "Rating Status"}</label>
                                <select
                                  name="verified"
                                  defaultValue={selectedMfg.verified ? "true" : "false"}
                                  className="w-full bg-white text-slate-800 rounded-lg p-1.5 border border-slate-200"
                                >
                                  <option value="true">Verified Supplier</option>
                                  <option value="false">Unverified</option>
                                </select>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-[10px] pt-2 space-y-1 text-slate-500">
                              <p>First Sourced: <strong className="text-slate-800">{selectedMfg.firstContactDate || "N/A"}</strong></p>
                              <p>Last Activity: <strong className="text-slate-800">{selectedMfg.lastContactDate || "N/A"}</strong></p>
                              <p>Source Node: <strong className="text-slate-800">{selectedMfg.source || "Direct"}</strong></p>
                              <p>Preferred Supplier: <strong className={selectedMfg.preferredSupplier ? "text-emerald-700" : "text-slate-700"}>{selectedMfg.preferredSupplier ? "YES" : "NO"}</strong></p>
                            </div>
                          </div>

                          {/* Factory Basic info */}
                          <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 space-y-3">
                            <h4 className="font-bold text-slate-800 pb-1 border-b border-slate-100">{isZh ? "厂家基本参数" : "Factory Capacity PIM"}</h4>
                            
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 block">{isZh ? "年产能" : "Annual Capacity"}</label>
                                <input
                                  type="text"
                                  name="annualCapacity"
                                  defaultValue={selectedMfg.annualCapacity || "2,000 Units"}
                                  className="w-full bg-white rounded p-1 border border-slate-200"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 block">{isZh ? "厂区面积(㎡)" : "Factory Area (Sqm)"}</label>
                                <input
                                  type="number"
                                  name="factoryAreaSqm"
                                  defaultValue={selectedMfg.factoryAreaSqm || 12000}
                                  className="w-full bg-white rounded p-1 border border-slate-200"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 block">{isZh ? "员工数" : "Employees"}</label>
                                <input
                                  type="number"
                                  name="employees"
                                  defaultValue={selectedMfg.employees || 150}
                                  className="w-full bg-white rounded p-1 border border-slate-200"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 block">OEM</label>
                                <select name="oem" defaultValue={selectedMfg.oem ? "true" : "false"} className="w-full bg-white p-1 rounded border border-slate-200">
                                  <option value="true">YES</option>
                                  <option value="false">NO</option>
                                </select>
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 block">ODM</label>
                                <select name="odm" defaultValue={selectedMfg.odm ? "true" : "false"} className="w-full bg-white p-1 rounded border border-slate-200">
                                  <option value="true">YES</option>
                                  <option value="false">NO</option>
                                </select>
                              </div>
                            </div>
                          </div>

                        </div>

                        {/* Contacts and Naming Details */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-3">
                            <h4 className="font-bold text-slate-800 block uppercase tracking-wide text-[10px] border-b border-slate-100 pb-1">
                              {isZh ? "企业名称与主页" : "Corporate Details"}
                            </h4>
                            <div className="space-y-2">
                              <div>
                                <label className="text-[10px] font-bold text-slate-400 block">{isZh ? "英文公司名" : "English Company Name"}</label>
                                <input type="text" name="companyName" defaultValue={selectedMfg.companyName} className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 focus:bg-white text-xs" />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-slate-400 block">{isZh ? "中文公司名" : "Chinese Company Name"}</label>
                                <input type="text" name="companyNameCn" defaultValue={selectedMfg.companyNameCn || ""} className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 focus:bg-white text-xs" />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-slate-400 block">{isZh ? "官方网站" : "Website"}</label>
                                <input type="text" name="website" defaultValue={selectedMfg.website || ""} className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 focus:bg-white text-xs" />
                              </div>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <h4 className="font-bold text-slate-800 block uppercase tracking-wide text-[10px] border-b border-slate-100 pb-1">
                              {isZh ? "对接人及即时通讯" : "Contact Personnel & IM"}
                            </h4>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[10px] font-bold text-slate-400 block">{isZh ? "联系人姓名" : "Contact Person"}</label>
                                <input type="text" name="contactPerson" defaultValue={selectedMfg.contactPerson} className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 focus:bg-white" />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-slate-400 block">{isZh ? "职位" : "Title"}</label>
                                <input type="text" name="title" defaultValue={selectedMfg.title || ""} className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 focus:bg-white" />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[10px] font-bold text-slate-400 block">Email</label>
                                <input type="text" name="email" defaultValue={selectedMfg.email} className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 focus:bg-white" />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-slate-400 block">{isZh ? "电话" : "Phone"}</label>
                                <input type="text" name="phone" defaultValue={selectedMfg.phone} className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 focus:bg-white" />
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <label className="text-[10px] font-bold text-slate-400 block">WeChat (微信)</label>
                                <input type="text" name="wechat" defaultValue={selectedMfg.wechat || ""} className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 focus:bg-white" />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-slate-400 block">WhatsApp</label>
                                <input type="text" name="whatsapp" defaultValue={selectedMfg.whatsapp || ""} className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 focus:bg-white" />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-slate-400 block">Mobile</label>
                                <input type="text" name="mobile" defaultValue={selectedMfg.mobile || ""} className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 focus:bg-white" />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Location and Notes */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                          <div className="space-y-2">
                            <h4 className="font-bold text-slate-800 block uppercase tracking-wide text-[10px]">
                              {isZh ? "厂家地理定位" : "Geography & Address"}
                            </h4>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[10px] font-bold text-slate-400 block">{isZh ? "省份" : "Province"}</label>
                                <input type="text" name="province" defaultValue={selectedMfg.province || ""} className="w-full bg-slate-50 border border-slate-200 rounded p-1.5" />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-slate-400 block">{isZh ? "城市" : "City"}</label>
                                <input type="text" name="city" defaultValue={selectedMfg.city || ""} className="w-full bg-slate-50 border border-slate-200 rounded p-1.5" />
                              </div>
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-slate-400 block">{isZh ? "详细地址" : "Address"}</label>
                              <input type="text" name="address" defaultValue={selectedMfg.address} className="w-full bg-slate-50 border border-slate-200 rounded p-1.5" />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label className="font-bold text-slate-800 block uppercase tracking-wide text-[10px]">{isZh ? "商洽备忘录" : "Procurement Notes"}</label>
                            <textarea
                              name="notes"
                              defaultValue={selectedMfg.notes || ""}
                              rows={4}
                              placeholder={isZh ? "在此录入该厂家的外贸合规评级、付款倾向、跟进问题..." : "Write down special shipping conditions, custom specifications negotiated..."}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 font-medium"
                            />
                          </div>
                        </div>

                        {/* Submit Button */}
                        <div className="flex justify-end pt-3">
                          <button
                            type="submit"
                            className="bg-slate-900 hover:bg-slate-800 text-white font-black px-6 py-2.5 rounded-xl flex items-center space-x-1.5 transition-all shadow-xs"
                          >
                            <Save className="w-4 h-4 text-amber-400" />
                            <span>{isZh ? "保存厂家CRM属性变更" : "Save Profile & CRM Updates"}</span>
                          </button>
                        </div>
                      </form>
                    )}

                    {/* WORKSPACE TAB 2: PIM MODEL MANAGEMENT */}
                    {workspaceTab === "pim" && (
                      <div className="space-y-4 text-xs">
                        
                        <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
                          <div>
                            <h4 className="font-bold text-slate-900">{isZh ? "上架产品与房型主数据表" : "Manufacturer Specifications PIM Table"}</h4>
                            <p className="text-[10px] text-slate-400">{isZh ? "维护该厂家发布的所有钢结构房屋模型，价格，风载，和海运参数。" : "Add, delete, or inspect standard structural engineering parameters for buyers."}</p>
                          </div>
                          
                          <button
                            onClick={() => setIsAddingModel(!isAddingModel)}
                            className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-3.5 py-2 rounded-xl flex items-center space-x-1 transition-all"
                          >
                            <Plus className="w-3.5 h-3.5 text-amber-400" />
                            <span>{isZh ? "录入标准房型" : "Add Model Spec"}</span>
                          </button>
                        </div>

                        {/* Add model panel form */}
                        {isAddingModel && (
                          <form onSubmit={handleAddSpecModel} className="bg-amber-50/20 border border-amber-200/50 rounded-2xl p-4 space-y-3">
                            <div className="flex justify-between items-center border-b border-amber-100 pb-2">
                              <span className="font-bold text-amber-900 flex items-center space-x-1">
                                <Plus className="w-4 h-4" />
                                <span>{isZh ? "录入新房型标准规格 (PIM)" : "Record New Prefab Spec (PIM)"}</span>
                              </span>
                              <button type="button" onClick={() => setIsAddingModel(false)} className="text-slate-400 hover:text-slate-600 font-bold">Cancel</button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div className="space-y-1">
                                <label className="font-bold text-slate-500 block">Model Name *</label>
                                <input
                                  type="text"
                                  required
                                  placeholder="e.g. Apollo Smart Pod"
                                  value={newModel.name}
                                  onChange={(e) => setNewModel({...newModel, name: e.target.value})}
                                  className="w-full bg-white rounded p-1.5 border border-slate-200"
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="font-bold text-slate-500 block">Model Number</label>
                                <input
                                  type="text"
                                  placeholder="e.g. AP-380"
                                  value={newModel.modelNumber}
                                  onChange={(e) => setNewModel({...newModel, modelNumber: e.target.value})}
                                  className="w-full bg-white rounded p-1.5 border border-slate-200"
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="font-bold text-slate-500 block">Category</label>
                                <select
                                  value={newModel.category}
                                  onChange={(e) => setNewModel({...newModel, category: e.target.value})}
                                  className="w-full bg-white rounded p-1.5 border border-slate-200"
                                >
                                  <option value="Tiny House">Tiny House</option>
                                  <option value="ADU">ADU (Backyard Cabin)</option>
                                  <option value="Modular House">Modular House</option>
                                  <option value="Container House">Container House</option>
                                  <option value="Cabin">Cabin / Glamping</option>
                                </select>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div className="space-y-1">
                                <label className="font-bold text-slate-500 block">FOB Price (USD) *</label>
                                <input
                                  type="number"
                                  required
                                  value={newModel.price}
                                  onChange={(e) => setNewModel({...newModel, price: Number(e.target.value)})}
                                  className="w-full bg-white rounded p-1.5 border border-slate-200"
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="font-bold text-slate-500 block">Size Dimensions</label>
                                <input
                                  type="text"
                                  placeholder="e.g. 11.5m x 2.2m x 2.5m"
                                  value={newModel.size}
                                  onChange={(e) => setNewModel({...newModel, size: e.target.value})}
                                  className="w-full bg-white rounded p-1.5 border border-slate-200"
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="font-bold text-slate-500 block">Area (Sq Ft) *</label>
                                <input
                                  type="number"
                                  required
                                  value={newModel.area}
                                  onChange={(e) => setNewModel({...newModel, area: Number(e.target.value)})}
                                  className="w-full bg-white rounded p-1.5 border border-slate-200"
                                />
                              </div>
                            </div>

                            <div className="space-y-1">
                              <label className="font-bold text-slate-500 block">Description & Structural Specs</label>
                              <textarea
                                value={newModel.description}
                                onChange={(e) => setNewModel({...newModel, description: e.target.value})}
                                placeholder="Describe sandwich insulation, glass type, structural steel thickness..."
                                className="w-full bg-white rounded-xl p-2 border border-slate-200"
                                rows={2}
                              />
                            </div>

                            <div className="flex justify-end pt-1">
                              <button
                                type="submit"
                                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black px-5 py-2 rounded-xl transition-all shadow-xs"
                              >
                                {isZh ? "保存并录入 PIM" : "Publish to Catalog"}
                              </button>
                            </div>
                          </form>
                        )}

                        {/* Listed Models catalog under selectedMfg */}
                        <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-3xs">
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="bg-slate-50 font-bold text-slate-500 border-b border-slate-100">
                                <th className="p-3">{isZh ? "型号/房型" : "Model name"}</th>
                                <th className="p-3">{isZh ? "类型" : "Type"}</th>
                                <th className="p-3">{isZh ? "规格面积" : "Size / Area"}</th>
                                <th className="p-3">{isZh ? "FOB 出厂价" : "FOB Base Price"}</th>
                                <th className="p-3 text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 text-slate-700">
                              {products.filter(p => p.manufacturerId === selectedMfg.id).length === 0 ? (
                                <tr>
                                  <td colSpan={5} className="p-8 text-center text-slate-400">
                                    {isZh ? "该厂家在 PIM 中尚未录入任何标准模型规格。请在下方使用 AI 邮件开发一键自动提取！" : "No specifications listed for this manufacturer yet. Run AI Outreach to automatically extract standard models!"}
                                  </td>
                                </tr>
                              ) : (
                                products.filter(p => p.manufacturerId === selectedMfg.id).map(p => (
                                  <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="p-3">
                                      <strong className="text-slate-900 block font-semibold">{p.name}</strong>
                                      <span className="text-[10px] text-slate-400 font-mono">ID: {p.modelNumber}</span>
                                    </td>
                                    <td className="p-3">
                                      <span className="bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-[10px] text-slate-600">
                                        {p.category}
                                      </span>
                                    </td>
                                    <td className="p-3 font-medium">
                                      <span>{p.size}</span>
                                      <span className="block text-[10px] text-slate-400">{p.area} sq ft</span>
                                    </td>
                                    <td className="p-3">
                                      <strong className="text-slate-950 font-bold">${p.price.toLocaleString()}</strong>
                                    </td>
                                    <td className="p-3 text-right">
                                      <button
                                        onClick={() => handleDeleteModel(p.id)}
                                        className="text-rose-500 hover:text-rose-700 p-1 rounded hover:bg-rose-50"
                                        title="Delete model spec"
                                      >
                                        <Trash className="w-3.5 h-3.5" />
                                      </button>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>

                      </div>
                    )}

                    {/* WORKSPACE TAB 3: AI OUTREACH AUTOMATION */}
                    {workspaceTab === "outreach" && (
                      <div className="space-y-4 text-xs">
                        
                        <div className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="flex items-center space-x-1 text-amber-400 font-bold">
                              <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
                              <span>{isZh ? "Gemini-3.5-Flash 智能跨境商洽顾问" : "Gemini AI Sourcing Outreach Agent"}</span>
                            </span>
                            <span className="bg-white/10 text-white font-mono text-[9px] px-2 py-0.5 rounded border border-white/10 uppercase">
                              AUTOMATION ACTIVE
                            </span>
                          </div>

                          <p className="text-[11px] text-slate-300 leading-relaxed">
                            {isZh 
                              ? "利用大模型分析厂家的地理区位和历史主推产品（如：折叠房/重钢别墅），自动撰写一份带有结构资质要求（CE/CSA认证）、给排水美规（NEC/UPC）询问的高专业度商业开发信，并对厂家回复进行一键结构化房型参数提取。"
                              : "Compose legal-compliant B2B inquiries, send SMTP routing mockups, and automatically extract standard house models with pricing specifications directly into the manufacturer's active PIM list."}
                          </p>

                          {/* Sourcing State Matrix indicators */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                            <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                              <span className="text-slate-400 block text-[8px] uppercase font-bold">{isZh ? "CRM状态" : "CRM Status"}</span>
                              <strong className="text-xs text-white block mt-0.5">{selectedMfg.contactStatus || "Not Contacted"}</strong>
                            </div>
                            <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                              <span className="text-slate-400 block text-[8px] uppercase font-bold">{isZh ? "开发信已发" : "Outreach Sent"}</span>
                              <strong className="text-xs text-white block mt-0.5">{selectedMfg.lastEmailSent ? "YES" : "NO"}</strong>
                            </div>
                            <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                              <span className="text-slate-400 block text-[8px] uppercase font-bold">{isZh ? "产品画册已收" : "Catalog Rec'd"}</span>
                              <strong className={selectedMfg.productCatalogReceived ? "text-emerald-400 text-xs block mt-0.5" : "text-slate-500 text-xs block mt-0.5"}>
                                {selectedMfg.productCatalogReceived ? "✔ RECEIVED" : "✘ PENDING"}
                              </strong>
                            </div>
                            <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                              <span className="text-slate-400 block text-[8px] uppercase font-bold">{isZh ? "CAD图纸已收" : "CAD drawings"}</span>
                              <strong className={selectedMfg.cadReceived ? "text-emerald-400 text-xs block mt-0.5" : "text-slate-500 text-xs block mt-0.5"}>
                                {selectedMfg.cadReceived ? "✔ RECEIVED" : "✘ PENDING"}
                              </strong>
                            </div>
                          </div>
                        </div>

                        {/* AI STEP ENGINE INTERFACES */}
                        {aiStep === "idle" && (
                          <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-3">
                            <Mail className="w-10 h-10 text-slate-300 mx-auto" />
                            <div>
                              <h4 className="font-bold text-slate-700">{isZh ? "开始 AI 自动商洽流程" : "Initiate AI B2B Sourcing Flow"}</h4>
                              <p className="text-[11px] text-slate-400 mt-0.5">
                                {isZh 
                                  ? `将自动为 [${selectedMfg.companyName}] 撰写符合美规要求的出厂技术询盘...`
                                  : `We will draft structural inquiries for ${selectedMfg.companyName} dynamically.`}
                              </p>
                            </div>
                            <button
                              onClick={handleGenerateOutreachEmail}
                              className="bg-slate-900 hover:bg-slate-800 text-white font-black px-5 py-2.5 rounded-xl flex items-center space-x-1.5 transition-all mx-auto shadow-xs"
                            >
                              <Sparkles className="w-4 h-4 text-amber-400" />
                              <span>{isZh ? "用 Gemini 生成定制开发函" : "Draft Sourcing Inquiry via Gemini"}</span>
                            </button>
                          </div>
                        )}

                        {aiStep === "drafting" && (
                          <div className="text-center py-12 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                            <RefreshCw className="w-8 h-8 text-amber-500 animate-spin mx-auto" />
                            <div>
                              <p className="font-bold text-slate-700">{isZh ? "Gemini-3.5-Flash 正在生成开发信..." : "Gemini is composing highly detailed specifications inquiry..."}</p>
                              <p className="text-[10px] text-slate-400">正在分析厂家地理位置与最适出口房型...</p>
                            </div>
                          </div>
                        )}

                        {aiStep === "drafted" && (
                          <div className="space-y-3">
                            <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                              <span className="font-bold text-slate-800">{isZh ? "企业开发信拟稿完成 (英文)" : "Drafted Partnering Proposal (English)"}</span>
                              <span className="text-[10px] text-slate-400 font-bold">READY TO ROUTE</span>
                            </div>

                            <textarea
                              value={outreachDraft}
                              onChange={(e) => setOutreachDraft(e.target.value)}
                              rows={10}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-mono text-xs text-slate-700 leading-normal"
                            />

                            <div className="flex justify-end space-x-2">
                              <button
                                onClick={() => setAiStep("idle")}
                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                              >
                                {isZh ? "重置" : "Cancel"}
                              </button>
                              <button
                                onClick={handleSendOutreachEmail}
                                className="bg-slate-900 hover:bg-slate-800 text-white font-black px-6 py-2.5 rounded-xl flex items-center space-x-1.5 shadow-xs"
                              >
                                <Send className="w-4 h-4 text-amber-400" />
                                <span>{isZh ? "启动国际SMTP发信" : "Initiate SMTP Routing"}</span>
                              </button>
                            </div>
                          </div>
                        )}

                        {aiStep === "sending" && (
                          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-3">
                            <div className="flex justify-between items-center text-[10px] font-bold text-slate-500">
                              <span>SMTP TRANSFER CHANNEL</span>
                              <span>{progressPercent}%</span>
                            </div>
                            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                              <div className="bg-slate-900 h-full transition-all duration-300" style={{ width: `${progressPercent}%` }} />
                            </div>
                            <p className="text-center font-bold text-slate-700 pt-1 font-mono">{progressMsg}</p>
                          </div>
                        )}

                        {aiStep === "sent" && (
                          <div className="text-center py-10 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-4">
                            <MailCheck className="w-12 h-12 text-emerald-600 mx-auto" />
                            <div className="space-y-1">
                              <h4 className="font-bold text-emerald-900">{isZh ? "开发信已成功投递！" : "Inquiry Mail Dispatched Successfully!"}</h4>
                              <p className="text-[11px] text-emerald-700">
                                {isZh 
                                  ? `邮件已发送给 ${selectedMfg.contactPerson} (${selectedMfg.email})。该厂家已迁移为“已联系(Contacted)”状态。` 
                                  : `Sourcing mail queued and dispatched to ${selectedMfg.contactPerson}. Status transitioned to Contacted.`}
                              </p>
                            </div>
                            
                            <div className="pt-2">
                              <button
                                onClick={handleListenForReply}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-6 py-2.5 rounded-xl flex items-center space-x-1.5 transition-colors mx-auto shadow-xs"
                              >
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                <span>{isZh ? "监听厂家自动报价回函" : "Listen for Supplier Automated Quotation Reply"}</span>
                              </button>
                            </div>
                          </div>
                        )}

                        {aiStep === "replying" && (
                          <div className="text-center py-12 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                            <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin mx-auto" />
                            <div>
                              <p className="font-bold text-slate-700">{isZh ? "正建立安全的国际邮件同步隧道..." : "Syncing carrier mail systems with Chinese servers..."}</p>
                              <p className="text-[10px] text-slate-400">正在分析厂家回复，使用 OCR 与 NLP 算法分析画册附件及 FOB 美元报价单...</p>
                            </div>
                          </div>
                        )}

                        {aiStep === "replied" && (
                          <div className="space-y-4">
                            
                            {/* Response details */}
                            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                              <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                                <span className="font-bold text-emerald-800 flex items-center space-x-1.5">
                                  <MailCheck className="w-4 h-4" />
                                  <span>{isZh ? "厂家报价回函附件 (中英双语)" : "Supplier Quotation Reply (Bilingual)"}</span>
                                </span>
                                <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-[9px]">
                                  Sourcing Catalog Received
                                </span>
                              </div>

                              {/* Simulated email letterbox content */}
                              <div className="bg-white border border-slate-100 p-4 rounded-xl font-mono text-[11px] text-slate-600 max-h-[250px] overflow-y-auto whitespace-pre-wrap leading-relaxed">
                                {outreachReply}
                              </div>

                              <div className="flex flex-wrap gap-2 pt-1">
                                <span className="bg-slate-100 border border-slate-200 text-slate-700 px-2 py-1 rounded text-[10px] font-bold">
                                  📎 Catalog_Export_2026.pdf (FOB Standard)
                                </span>
                                <span className="bg-slate-100 border border-slate-200 text-slate-700 px-2 py-1 rounded text-[10px] font-bold">
                                  📎 Standard_Price_Matrix.xlsx (FOB US Market)
                                </span>
                                <span className="bg-slate-100 border border-slate-200 text-slate-700 px-2 py-1 rounded text-[10px] font-bold">
                                  📎 CAD_Structure_Drawings.zip
                                </span>
                              </div>
                            </div>

                            {/* Extracted specifications panel card */}
                            {extractedModels.length > 0 && (
                              <div className="bg-amber-50/40 border border-amber-200 rounded-2xl p-4 space-y-3">
                                <div className="flex items-center space-x-1.5 text-amber-900 font-bold border-b border-amber-200 pb-2 text-xs">
                                  <Sparkles className="w-4 h-4 text-amber-500" />
                                  <span>{isZh ? "Gemini NLP 模型提炼出的标准产品规格 (PIM)" : "Gemini AI-Extracted Product Specs (PIM)"}</span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {extractedModels.map((model, idx) => (
                                    <div key={idx} className="bg-white p-3.5 rounded-xl border border-amber-200/50 space-y-2">
                                      <div className="flex justify-between items-start">
                                        <div>
                                          <h5 className="font-bold text-slate-900 text-xs">{model.name}</h5>
                                          <p className="text-[10px] text-slate-400 font-mono">Model No: {model.modelNumber}</p>
                                        </div>
                                        <span className="text-emerald-700 font-extrabold text-xs">
                                          FOB ${model.price?.toLocaleString()}
                                        </span>
                                      </div>
                                      <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-500 font-medium">
                                        <p>Dimensions: <span className="text-slate-800">{model.size}</span></p>
                                        <p>Area: <span className="text-slate-800">{model.area} sq ft</span></p>
                                        <p className="col-span-2 mt-1 border-t border-slate-50 pt-1 line-clamp-2 italic leading-relaxed text-[9px]">{model.description}</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>

                                <div className="flex justify-end pt-2">
                                  <button
                                    onClick={handleCommitSourcingData}
                                    className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black px-6 py-3 rounded-xl flex items-center space-x-1.5 shadow-md text-xs transition-transform transform active:scale-95"
                                  >
                                    <Database className="w-4 h-4" />
                                    <span>{isZh ? "一键写入 PIM 规格库 & 同步激活厂家" : "Commit AI Sourcing & Write to PIM Catalog"}</span>
                                  </button>
                                </div>
                              </div>
                            )}

                          </div>
                        )}

                      </div>
                    )}

                  </>
                ) : (
                  <div className="text-center py-24 text-slate-400">
                    <Database className="w-12 h-12 text-slate-200 mx-auto mb-2" />
                    <p>{isZh ? "请先在左侧选择或录入厂家，开始进行 PIM 及 CRM 业务管理。" : "Please select or import a manufacturer from the directory list to start."}</p>
                  </div>
                )}
              </div>

            </div>
          ) : (
            // CRAWLER MASTER INDEX TAB
            <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-2xs space-y-4">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="font-sans font-bold text-slate-900 text-sm">
                    {isZh ? "中国源头集成房屋厂家总数据库 (Canton Fair / AlibabaVerified / CIHIE 汇总)" : "Chinese Prefab Manufacturers Master Index DB"}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {isZh 
                      ? "中国350余家注册出口集成房屋、空间舱、轻钢别墅总名录。支持全方位资质初筛，一键将其导入本地活跃 Sourcing CRM 系统开展 AI 自动询价。" 
                      : "Search and index from over 350 verified Chinese modular suppliers. Import into active Sourcing CRM instantly."}
                  </p>
                </div>
                
                <span className="bg-slate-150 text-slate-700 font-mono text-[10px] px-3 py-1 rounded-full border border-slate-200 font-bold shrink-0">
                  {totalCrawlerItems} {isZh ? "家未导入厂家" : "available suppliers"}
                </span>
              </div>

              {/* Crawler Filters */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                <div className="md:col-span-8 relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={crawlerQuery}
                    onChange={(e) => {
                      setCrawlerQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder={isZh ? "全局搜索厂家英文名、中文名、出口产品类型、认证资质..." : "Query company names, cities, product tags, source platforms..."}
                    className="w-full bg-slate-50 text-slate-800 placeholder-slate-400 rounded-xl pl-10 pr-4 py-2.5 text-xs outline-hidden border border-slate-100 focus:border-slate-300 focus:bg-white"
                  />
                </div>

                <div className="md:col-span-4 flex space-x-2">
                  <select
                    value={crawlerProvinceFilter}
                    onChange={(e) => {
                      setCrawlerProvinceFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="flex-1 bg-slate-50 text-slate-700 rounded-xl px-3 py-2.5 text-xs outline-hidden border border-slate-100"
                  >
                    <option value="ALL">{isZh ? "全部省份/地区" : "All Provinces"}</option>
                    {crawlerProvinces.map(prov => (
                      <option key={prov} value={prov}>{prov}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Crawler Table */}
              <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-3xs text-xs">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 font-bold text-slate-500 border-b border-slate-150">
                      <th className="p-3.5">{isZh ? "中国厂家名 (中英文)" : "Company details"}</th>
                      <th className="p-3.5">{isZh ? "对接人及即时通讯" : "Contact / IM"}</th>
                      <th className="p-3.5">{isZh ? "主营出口产品" : "Key Export Products"}</th>
                      <th className="p-3.5">{isZh ? "海关与标准认证" : "Certifications"}</th>
                      <th className="p-3.5 text-center">{isZh ? "数据来源" : "Source"}</th>
                      <th className="p-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-600">
                    {paginatedCrawlerDb.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-12 text-center text-slate-400 font-medium">
                          {isZh ? "未检索到匹配的记录。" : "No suppliers match your search criteria."}
                        </td>
                      </tr>
                    ) : (
                      paginatedCrawlerDb.map((m) => (
                        <tr key={m.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-3.5">
                            <div className="flex items-center space-x-1.5">
                              {m.verified && (
                                <span className="bg-emerald-100 text-emerald-700 text-[8px] font-bold px-1.5 rounded-sm">VERIFIED</span>
                              )}
                              <strong className="text-slate-900 block font-bold">{m.companyName}</strong>
                            </div>
                            <span className="text-[10px] text-slate-400 block mt-0.5">{m.companyNameCn || ""}</span>
                            <span className="text-[10px] text-slate-400 font-medium">{m.city || m.province}, China • Est. {m.yearEstablished}</span>
                          </td>
                          <td className="p-3.5 font-medium">
                            <span className="text-slate-900 block font-semibold">{m.contactPerson}</span>
                            <span className="text-[10px] text-slate-400 font-mono block">{m.email}</span>
                            <span className="text-[10px] text-slate-400 font-mono">WeChat: {m.wechat}</span>
                          </td>
                          <td className="p-3.5 font-medium text-[11px]">
                            {m.products?.join(", ") || "Integrated Structures"}
                          </td>
                          <td className="p-3.5">
                            <div className="flex flex-wrap gap-1">
                              {m.certifications.map((c, i) => (
                                <span key={i} className="bg-slate-100 text-slate-600 font-bold px-1.5 py-0.5 rounded text-[9px]">
                                  {c}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="p-3.5 text-center font-bold text-[10px] text-slate-400 font-mono">
                            {m.source || "Database"}
                          </td>
                          <td className="p-3.5 text-right">
                            <button
                              onClick={() => handleImportManufacturer(m)}
                              className="bg-slate-900 hover:bg-slate-800 text-white font-black px-3.5 py-1.5 rounded-xl flex items-center space-x-1 transition-colors inline-flex"
                            >
                              <Plus className="w-3.5 h-3.5 text-amber-400" />
                              <span>{isZh ? "引入 CRM" : "Import"}</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Crawler Pagination Footer */}
              {totalPages > 1 && (
                <div className="flex justify-between items-center pt-4 border-t border-slate-50 text-xs">
                  <span className="text-slate-400">
                    Showing <strong className="text-slate-700">{(currentPage - 1) * itemsPerPage + 1}</strong> to <strong className="text-slate-700">{Math.min(currentPage * itemsPerPage, totalCrawlerItems)}</strong> of <strong className="text-slate-700">{totalCrawlerItems}</strong> manufacturers
                  </span>

                  <div className="flex space-x-1">
                    <button
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(currentPage - 1)}
                      className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                    >
                      {isZh ? "上一页" : "Prev"}
                    </button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const page = i + 1;
                      return (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`px-3 py-1.5 rounded-lg border font-bold ${
                            currentPage === page
                              ? "bg-slate-900 border-slate-900 text-white"
                              : "border-slate-200 text-slate-500 hover:bg-slate-50"
                          }`}
                        >
                          {page}
                        </button>
                      );
                    })}
                    <button
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(currentPage + 1)}
                      className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                    >
                      {isZh ? "下一页" : "Next"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      )}

      {/* PORTAL VIEW 2: MANUFACTURER REVIEW */}
      {activeTab === "mfg-review" && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-2xs space-y-4">
            <h3 className="font-sans font-bold text-slate-900 text-sm mb-4">
              {isZh ? "入驻中国源头厂家资质审批队列" : "Chinese Factory Verification Pipelines"}
            </h3>
            
            {pendingMFGs.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                <ShieldCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p>{isZh ? "暂无待审批的厂家入驻申请。" : "All pending manufacturer licenses approved."}</p>
              </div>
            ) : (
              <div className="space-y-4 text-xs text-slate-700">
                {pendingMFGs.map((mfg) => (
                  <div key={mfg.id} className="border border-slate-100 rounded-2xl p-5 bg-amber-50/20 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                    
                    {/* Factory profile description */}
                    <div className="md:col-span-8 space-y-2">
                      <div className="flex items-center space-x-2">
                        <span className="bg-amber-500 text-slate-950 px-2 py-0.5 rounded font-bold text-[9px] uppercase tracking-wide">PENDING VERIFICATION</span>
                        <h4 className="font-sans font-black text-slate-900 text-sm">{mfg.companyName}</h4>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-slate-500 font-medium">
                        <p>{isZh ? "联系人" : "Contact Person"}: <strong className="text-slate-800">{mfg.contactPerson}</strong></p>
                        <p>{isZh ? "厂址" : "Factory Address"}: <span className="text-slate-800">{mfg.address}</span></p>
                        <p>{isZh ? "海关与行业认证" : "Certifications"}: <span className="text-emerald-700 font-bold">{mfg.certifications.join(", ")}</span></p>
                      </div>
                      <div className="pt-2 flex space-x-2">
                        <span className="bg-slate-100 border border-slate-200 text-slate-700 font-semibold px-2 py-1 rounded">
                          📁 {isZh ? "企业执照.pdf" : "business-license-cn.pdf"}
                        </span>
                        <span className="bg-slate-100 border border-slate-200 text-slate-700 font-semibold px-2 py-1 rounded">
                          📁 {isZh ? "外贸资格证书.pdf" : "export-credential.pdf"}
                        </span>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="md:col-span-4 flex justify-end space-x-2">
                      <button
                        onClick={() => onRejectManufacturer(mfg.id)}
                        className="px-4 py-2.5 border border-rose-200 text-rose-600 font-bold rounded-xl hover:bg-rose-50"
                      >
                        {isZh ? "拒绝驳回" : "Reject License"}
                      </button>
                      <button
                        onClick={() => onApproveManufacturer(mfg.id)}
                        className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center space-x-1 shadow-xs"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{getTranslation(language, "approveBtn")}</span>
                      </button>
                    </div>

                  </div>
                ))}
              </div>
            )}
          </div>

          {/* List of already verified manufactures */}
          <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-2xs space-y-3">
            <h4 className="font-sans font-bold text-slate-900 text-xs uppercase tracking-wider mb-2">{isZh ? "已验证资质的入驻厂家" : "Already Verified Factories"}</h4>
            <div className="divide-y divide-slate-100 text-xs text-slate-600">
              {approvedMFGs.map((m) => (
                <div key={m.id} className="py-3.5 flex justify-between items-center">
                  <div>
                    <strong className="text-slate-900 block font-semibold">{m.companyName}</strong>
                    <span className="text-[10px] text-slate-400">Export Rating: 5 Stars • {m.companyNameCn || ""}</span>
                  </div>
                  <span className="text-emerald-700 font-bold bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100">
                    Active Verified
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* PORTAL VIEW 3: PRODUCT AUDIT AND SELECTION REVIEW */}
      {activeTab === "prod-review" && (
        <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-2xs">
          <h3 className="font-sans font-bold text-slate-900 text-sm mb-4">{isZh ? "产品规格上架技术审查" : "Listed Modular Home Compliance Queue"}</h3>
          <p className="text-xs text-slate-400 mb-4">{isZh ? "审查所有中国工厂发布的钢结构配比、电路是否符合NEC规范、排水管是否符合美标UPC认证。" : "Review mechanical, electrical, and structural design conformity before listings appear on U.S. Buyer pages."}</p>
          
          <div className="divide-y divide-slate-100 text-xs text-slate-700">
            {products.map((p) => (
              <div key={p.id} className="py-4 flex flex-col sm:flex-row justify-between sm:items-center">
                <div className="space-y-1">
                  <strong className="text-slate-900 font-black text-sm">{p.name}</strong>
                  <span className="text-slate-400 block">Model No: {p.modelNumber} | FOB Price: ${p.price.toLocaleString()}</span>
                  <div className="flex space-x-1.5 pt-1">
                    <span className="bg-slate-100 text-slate-600 font-bold px-2 rounded text-[10px] border border-slate-200">
                      NEC pre-wired OK
                    </span>
                    <span className="bg-slate-100 text-slate-600 font-bold px-2 rounded text-[10px] border border-slate-200">
                      UPC plumbing OK
                    </span>
                  </div>
                </div>

                <div className="mt-2 sm:mt-0 flex space-x-2">
                  <span className="bg-emerald-50 text-emerald-700 font-bold border border-emerald-100 px-3 py-1.5 rounded-xl">
                    ✓ Verified Listed
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PORTAL VIEW 4: AUDIT TRAILS */}
      {activeTab === "audit-logs" && (
        <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-2xs space-y-4">
          <h3 className="font-sans font-bold text-slate-900 text-sm mb-2">{isZh ? "系统安全与交易链路日志" : "Platform Log Auditing Trail"}</h3>
          
          <div className="border border-slate-100 rounded-2xl overflow-hidden divide-y divide-slate-50 text-xs">
            <div className="grid grid-cols-12 p-3 bg-slate-100 font-bold text-slate-600">
              <span className="col-span-3">{getTranslation(language, "auditTime")}</span>
              <span className="col-span-3">{getTranslation(language, "auditAction")}</span>
              <span className="col-span-6">{getTranslation(language, "auditDetails")}</span>
            </div>

            {adminLogs.map((log) => (
              <div key={log.id} className="grid grid-cols-12 p-3.5 hover:bg-slate-50 transition-colors">
                <span className="col-span-3 font-mono text-slate-400 text-[10px]">{log.timestamp}</span>
                <span className="col-span-3 font-semibold text-slate-800">{log.action}</span>
                <span className="col-span-6 text-slate-600 leading-normal">{log.details}</span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
