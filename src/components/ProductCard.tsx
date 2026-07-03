import React from "react";
import { Product, Language } from "../types";
import { getTranslation } from "../utils/translation";
import { Heart, ArrowLeftRight, Clock, Box, Bed, Bath, Sparkles } from "lucide-react";

interface ProductCardProps {
  product: Product;
  language: Language;
  onViewDetails: (product: Product) => void;
  onToggleSave: (productId: string) => void;
  onToggleCompare: (product: Product) => void;
  onOpenQuoteRequest: (product: Product) => void;
  isSaved: boolean;
  isComparing: boolean;
}

export default function ProductCard({
  product,
  language,
  onViewDetails,
  onToggleSave,
  onToggleCompare,
  onOpenQuoteRequest,
  isSaved,
  isComparing
}: ProductCardProps) {
  const isZh = language === "zh";

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg transition-all overflow-hidden flex flex-col group">
      
      {/* Product Image Panel */}
      <div className="relative aspect-video bg-slate-100 overflow-hidden cursor-pointer" onClick={() => onViewDetails(product)}>
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-linear-to-t from-slate-900/60 via-transparent to-transparent opacity-60"></div>
        
        {/* Category Tag */}
        <span className="absolute top-3 left-3 bg-white/95 text-slate-800 backdrop-blur-xs text-[11px] font-bold px-2.5 py-1 rounded-lg uppercase tracking-wider shadow-xs">
          {isZh ? getChineseCategoryName(product.category) : product.category}
        </span>

        {/* Action Badges Top-Right */}
        <div className="absolute top-3 right-3 flex flex-col space-y-1.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleSave(product.id);
            }}
            className={`p-2 rounded-full backdrop-blur-md shadow-xs transition-all ${
              isSaved
                ? "bg-rose-500 text-white"
                : "bg-white/90 text-slate-600 hover:bg-white hover:text-rose-500"
            }`}
            title={getTranslation(language, "save")}
          >
            <Heart className={`w-4 h-4 ${isSaved ? "fill-current" : ""}`} />
          </button>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleCompare(product);
            }}
            className={`p-2 rounded-full backdrop-blur-md shadow-xs transition-all ${
              isComparing
                ? "bg-amber-500 text-white"
                : "bg-white/90 text-slate-600 hover:bg-white hover:text-amber-500"
            }`}
            title={getTranslation(language, "addToCompare")}
          >
            <ArrowLeftRight className="w-4 h-4" />
          </button>
        </div>

        {/* Small Bottom Features */}
        <div className="absolute bottom-3 left-3 flex space-x-1.5">
          {product.isCustomizable && (
            <span className="bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
              {isZh ? "支持定制" : "Customizable"}
            </span>
          )}
          {product.isSuitableForOffGrid && (
            <span className="bg-sky-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
              {isZh ? "适合离网" : "Off-Grid"}
            </span>
          )}
        </div>
      </div>

      {/* Card Details Body */}
      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          {/* Manufacturer Name */}
          <span className="text-xs font-semibold text-amber-600 tracking-wider uppercase mb-1 block">
            {product.manufacturerName.split(" ")[0]} Factory
          </span>

          {/* Model Name */}
          <h3 
            className="font-sans font-bold text-slate-900 text-lg group-hover:text-amber-600 transition-colors cursor-pointer leading-tight mb-2"
            onClick={() => onViewDetails(product)}
          >
            {product.name}
          </h3>

          {/* Quick Specs Icons Row */}
          <div className="grid grid-cols-4 gap-1 border-y border-slate-100 py-3 my-3 text-slate-500 text-xs">
            <div className="flex items-center space-x-1" title={getTranslation(language, "bedrooms")}>
              <Bed className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-semibold">{product.bedrooms} {isZh ? "卧" : "Beds"}</span>
            </div>
            
            <div className="flex items-center space-x-1" title={getTranslation(language, "bathrooms")}>
              <Bath className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-semibold">{product.bathrooms} {isZh ? "卫" : "Baths"}</span>
            </div>

            <div className="flex items-center space-x-1 col-span-2" title={getTranslation(language, "area")}>
              <Sparkles className="w-3.5 h-3.5 text-slate-400" />
              <span className="truncate font-semibold">{product.area} sqft ({Math.round(product.area * 0.0929)}㎡)</span>
            </div>
          </div>

          {/* Core Technical Badges list */}
          <div className="space-y-1.5 text-xs text-slate-500 mb-4">
            <div className="flex items-center space-x-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>{getTranslation(language, "productionTime")}: <strong>{product.productionTime} {isZh ? "天" : "Days"}</strong></span>
            </div>
            <div className="flex items-center space-x-1.5">
              <Box className="w-3.5 h-3.5 text-slate-400" />
              <span>{getTranslation(language, "requiredContainer")}: <strong className="bg-slate-100 px-1.5 py-0.5 rounded-sm text-slate-700 text-[10px]">{product.requiredContainers}</strong></span>
            </div>
          </div>
        </div>

        {/* FOB Price and CTA Buttons */}
        <div>
          <div className="flex justify-between items-baseline mb-4">
            <span className="text-xs text-slate-400 font-medium">{getTranslation(language, "startingFrom")}</span>
            <div className="text-right">
              <span className="text-2xl font-black text-slate-900">${product.price.toLocaleString()}</span>
              <span className="text-xs text-slate-500 font-medium block">FOB {isZh ? "出厂价" : "China Factory"}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              onClick={() => onViewDetails(product)}
              className="py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 hover:border-slate-300 transition-colors text-center"
            >
              {getTranslation(language, "viewDetails")}
            </button>
            
            <button
              onClick={() => onOpenQuoteRequest(product)}
              className="py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold shadow-xs transition-colors text-center"
            >
              {getTranslation(language, "requestQuote")}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

// Utility to localize categories cleanly
export function getChineseCategoryName(cat: string): string {
  const mapping: Record<string, string> = {
    "Tiny House": "微型移动房屋",
    "ADU": "后院小屋 (ADU)",
    "Modular House": "模块化装配别墅",
    "Container House": "集装箱住宅",
    "Cabin": "野奢度假木屋",
    "Garden Office": "后院办公舱",
    "Steel Villa": "轻钢别墅",
    "Prefab Garage": "装配式车库",
    "Commercial Unit": "商业模块单元"
  };
  return mapping[cat] || cat;
}
