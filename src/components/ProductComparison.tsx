import React from "react";
import { Product, Language } from "../types";
import { getTranslation } from "../utils/translation";
import { getChineseCategoryName } from "./ProductCard";
import { X, ArrowLeftRight, Check, Sparkles } from "lucide-react";

interface ProductComparisonProps {
  compareList: Product[];
  language: Language;
  onRemoveFromCompare: (productId: string) => void;
  onViewDetails: (product: Product) => void;
  onOpenQuoteRequest: (product: Product) => void;
}

export default function ProductComparison({
  compareList,
  language,
  onRemoveFromCompare,
  onViewDetails,
  onOpenQuoteRequest
}: ProductComparisonProps) {
  const isZh = language === "zh";

  if (compareList.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-4">
          <ArrowLeftRight className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-slate-800 mb-1">{getTranslation(language, "comparisonTable")}</h3>
        <p className="text-sm text-slate-500 max-w-sm mx-auto mb-6">{getTranslation(language, "noProductsCompare")}</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      
      {/* Header section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-100 pb-5">
        <div>
          <h2 className="font-sans font-extrabold text-2xl text-slate-900 flex items-center space-x-2">
            <ArrowLeftRight className="w-6 h-6 text-amber-500" />
            <span>{getTranslation(language, "comparisonTable")}</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">{getTranslation(language, "maxCompareWarning")}</p>
        </div>
      </div>

      {/* Comparison Grid */}
      <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full table-fixed border-collapse">
            
            {/* Table Header with Product info */}
            <thead>
              <tr className="bg-slate-50">
                <th className="w-60 p-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-100/50">
                  {getTranslation(language, "compareFields")}
                </th>
                {compareList.map((product) => (
                  <th key={product.id} className="p-5 text-left align-top border-l border-slate-100 min-w-[220px]">
                    <div className="relative group space-y-3">
                      
                      {/* Delete cross */}
                      <button
                        onClick={() => onRemoveFromCompare(product.id)}
                        className="absolute -top-1 -right-1 p-1 bg-white hover:bg-rose-100 text-slate-400 hover:text-rose-600 rounded-full border border-slate-200 shadow-xs transition-colors"
                        title={getTranslation(language, "removeFromCompare")}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>

                      <div className="aspect-video rounded-xl overflow-hidden bg-slate-100 shadow-2xs">
                        <img src={product.image} alt={product.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>

                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                          {isZh ? getChineseCategoryName(product.category) : product.category}
                        </span>
                        <h4 className="font-sans font-bold text-slate-950 text-sm truncate leading-tight mt-0.5" title={product.name}>
                          {product.name}
                        </h4>
                        <span className="text-xs text-slate-500 block">{product.manufacturerName.split(" ")[0]}</span>
                      </div>

                      <div>
                        <span className="text-lg font-black text-slate-900">${product.price.toLocaleString()}</span>
                        <span className="text-[10px] text-slate-400 block font-medium">FOB China</span>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5 text-xs">
                        <button
                          onClick={() => onViewDetails(product)}
                          className="py-1.5 rounded-lg border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 text-[10px]"
                        >
                          {isZh ? "产品详情" : "Details"}
                        </button>
                        <button
                          onClick={() => onOpenQuoteRequest(product)}
                          className="py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-[10px]"
                        >
                          {isZh ? "获取报价" : "Quote"}
                        </button>
                      </div>

                    </div>
                  </th>
                ))}
                {/* Pad empty columns if less than 4 */}
                {Array.from({ length: Math.max(0, 4 - compareList.length) }).map((_, i) => (
                  <th key={`empty-${i}`} className="p-5 text-center text-xs text-slate-300 border-l border-slate-100 min-w-[220px] align-middle bg-slate-50/20">
                    <div className="py-20">
                      <Sparkles className="w-5 h-5 mx-auto text-slate-200 mb-1" />
                      <span>{isZh ? "待添加对比模型" : "Empty slot"}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            {/* Table Rows */}
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              
              {/* Size */}
              <tr>
                <td className="p-4 font-bold bg-slate-50/50 text-slate-500">{getTranslation(language, "size")}</td>
                {compareList.map((product) => (
                  <td key={product.id} className="p-4 border-l border-slate-100 font-semibold">{product.size}</td>
                ))}
                {Array.from({ length: 4 - compareList.length }).map((_, i) => <td key={i} className="border-l border-slate-100 bg-slate-50/20"></td>)}
              </tr>

              {/* Area */}
              <tr>
                <td className="p-4 font-bold bg-slate-50/50 text-slate-500">{getTranslation(language, "area")}</td>
                {compareList.map((product) => (
                  <td key={product.id} className="p-4 border-l border-slate-100 font-semibold">{product.area} sq ft</td>
                ))}
                {Array.from({ length: 4 - compareList.length }).map((_, i) => <td key={i} className="border-l border-slate-100 bg-slate-50/20"></td>)}
              </tr>

              {/* Beds & Baths */}
              <tr>
                <td className="p-4 font-bold bg-slate-50/50 text-slate-500">{isZh ? "卧卫布局" : "Bedrooms / Bathrooms"}</td>
                {compareList.map((product) => (
                  <td key={product.id} className="p-4 border-l border-slate-100 font-semibold">
                    {product.bedrooms} {isZh ? "卧" : "Beds"} / {product.bathrooms} {isZh ? "卫" : "Baths"}
                  </td>
                ))}
                {Array.from({ length: 4 - compareList.length }).map((_, i) => <td key={i} className="border-l border-slate-100 bg-slate-50/20"></td>)}
              </tr>

              {/* Structure */}
              <tr>
                <td className="p-4 font-bold bg-slate-50/50 text-slate-500">{getTranslation(language, "structure")}</td>
                {compareList.map((product) => (
                  <td key={product.id} className="p-4 border-l border-slate-100 text-slate-600 font-semibold">{product.structureMaterial}</td>
                ))}
                {Array.from({ length: 4 - compareList.length }).map((_, i) => <td key={i} className="border-l border-slate-100 bg-slate-50/20"></td>)}
              </tr>

              {/* Wall Material */}
              <tr>
                <td className="p-4 font-bold bg-slate-50/50 text-slate-500">{getTranslation(language, "wall")}</td>
                {compareList.map((product) => (
                  <td key={product.id} className="p-4 border-l border-slate-100 text-slate-600">{product.wallMaterial}</td>
                ))}
                {Array.from({ length: 4 - compareList.length }).map((_, i) => <td key={i} className="border-l border-slate-100 bg-slate-50/20"></td>)}
              </tr>

              {/* Insulation */}
              <tr>
                <td className="p-4 font-bold bg-slate-50/50 text-slate-500">{getTranslation(language, "insulation")}</td>
                {compareList.map((product) => (
                  <td key={product.id} className="p-4 border-l border-slate-100 text-slate-600">{product.insulation}</td>
                ))}
                {Array.from({ length: 4 - compareList.length }).map((_, i) => <td key={i} className="border-l border-slate-100 bg-slate-50/20"></td>)}
              </tr>

              {/* Production Leadtime */}
              <tr>
                <td className="p-4 font-bold bg-slate-50/50 text-slate-500">{getTranslation(language, "productionTime")}</td>
                {compareList.map((product) => (
                  <td key={product.id} className="p-4 border-l border-slate-100 text-amber-700 font-bold">
                    {product.productionTime} {isZh ? "个工作日" : "Working Days"}
                  </td>
                ))}
                {Array.from({ length: 4 - compareList.length }).map((_, i) => <td key={i} className="border-l border-slate-100 bg-slate-50/20"></td>)}
              </tr>

              {/* Container Requirement */}
              <tr>
                <td className="p-4 font-bold bg-slate-50/50 text-slate-500">{getTranslation(language, "requiredContainer")}</td>
                {compareList.map((product) => (
                  <td key={product.id} className="p-4 border-l border-slate-100 text-slate-600 font-semibold bg-amber-50/30">
                    {product.requiredContainers}
                  </td>
                ))}
                {Array.from({ length: 4 - compareList.length }).map((_, i) => <td key={i} className="border-l border-slate-100 bg-slate-50/20"></td>)}
              </tr>

              {/* Customizable */}
              <tr>
                <td className="p-4 font-bold bg-slate-50/50 text-slate-500">{isZh ? "定制配置" : "Customizability"}</td>
                {compareList.map((product) => (
                  <td key={product.id} className="p-4 border-l border-slate-100">
                    {product.isCustomizable ? (
                      <span className="text-emerald-600 font-bold flex items-center space-x-1">
                        <Check className="w-4 h-4" />
                        <span>{isZh ? "支持全屋定制" : "Yes"}</span>
                      </span>
                    ) : (
                      <span className="text-slate-400">{isZh ? "仅支持标准版" : "Standard spec only"}</span>
                    )}
                  </td>
                ))}
                {Array.from({ length: 4 - compareList.length }).map((_, i) => <td key={i} className="border-l border-slate-100 bg-slate-50/20"></td>)}
              </tr>

              {/* Warranty */}
              <tr>
                <td className="p-4 font-bold bg-slate-50/50 text-slate-500">{getTranslation(language, "warranty")}</td>
                {compareList.map((product) => (
                  <td key={product.id} className="p-4 border-l border-slate-100 text-slate-600">{product.warranty}</td>
                ))}
                {Array.from({ length: 4 - compareList.length }).map((_, i) => <td key={i} className="border-l border-slate-100 bg-slate-50/20"></td>)}
              </tr>

            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
