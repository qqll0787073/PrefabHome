import React, { useState } from "react";
import { ManufacturerProfile, Product, AdminLog, Language } from "../types";
import { getTranslation } from "../utils/translation";
import { ShieldCheck, UserCheck, Eye, CheckCircle2, XCircle, FileClock, LayoutList, BarChart3, BellRing } from "lucide-react";

interface AdminDashboardProps {
  language: Language;
  manufacturers: ManufacturerProfile[];
  products: Product[];
  adminLogs: AdminLog[];
  onApproveManufacturer: (mfgId: string) => void;
  onRejectManufacturer: (mfgId: string) => void;
}

export default function AdminDashboard({
  language,
  manufacturers,
  products,
  adminLogs,
  onApproveManufacturer,
  onRejectManufacturer
}: AdminDashboardProps) {
  const isZh = language === "zh";
  const [activeTab, setActiveTab] = useState<"mfg-review" | "prod-review" | "audit-logs">("mfg-review");

  // Filter pending profiles
  const pendingMFGs = manufacturers.filter(m => m.status === "pending");
  const approvedMFGs = manufacturers.filter(m => m.status === "approved");

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
        <div className="grid grid-cols-2 gap-3 mt-4 md:mt-0 text-xs">
          <div className="bg-white/10 px-4 py-2.5 rounded-xl border border-white/15 min-w-[100px]">
            <span className="text-slate-400 block text-[9px] uppercase font-bold">{isZh ? "待审批厂家" : "Pending mfg"}</span>
            <strong className="text-lg text-amber-400 font-black">{pendingMFGs.length}</strong>
          </div>
          <div className="bg-white/10 px-4 py-2.5 rounded-xl border border-white/15 min-w-[100px]">
            <span className="text-slate-400 block text-[9px] uppercase font-bold">{isZh ? "上架产品数" : "Listed houses"}</span>
            <strong className="text-lg text-white font-black">{products.length}</strong>
          </div>
        </div>
      </div>

      {/* Internal admin tabs */}
      <div className="flex border-b border-slate-100 overflow-x-auto space-x-1.5">
        {[
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
                  ? "border-slate-900 text-slate-900 bg-white"
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

      {/* PORTAL VIEW 1: MANUFACTURER REVIEW */}
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
                        <p>{isZh ? "外贸出口经验" : "Export Experience"}: <span className="text-slate-800">{mfg.exportExperience}</span></p>
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
                    <span className="text-[10px] text-slate-400">Export Rating: 5 Stars • {m.exportExperience}</span>
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

      {/* PORTAL VIEW 2: PRODUCT AUDIT AND SELECTION REVIEW */}
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

      {/* PORTAL VIEW 3: AUDIT TRAILS */}
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
