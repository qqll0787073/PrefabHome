import React from "react";
import { Language, UserRole } from "../types";
import { getTranslation } from "../utils/translation";
import { Globe, Building2, User, Settings2, Heart, ArrowLeftRight, MessageSquare, Compass, ShieldCheck } from "lucide-react";

interface HeaderProps {
  language: Language;
  setLanguage: (lang: Language) => void;
  activeRole: UserRole;
  setActiveRole: (role: UserRole) => void;
  currentView: string;
  setCurrentView: (view: string) => void;
  savedCount: number;
  compareCount: number;
  unreadCount: number;
  authenticatedUser: { username: string; fullName: string; email: string } | null;
  onLogout: () => void;
}

export default function Header({
  language,
  setLanguage,
  activeRole,
  setActiveRole,
  currentView,
  setCurrentView,
  savedCount,
  compareCount,
  unreadCount,
  authenticatedUser,
  onLogout
}: HeaderProps) {
  const isZh = language === "zh";

  return (
    <header className="border-b border-gray-100 bg-white sticky top-0 z-40 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          
          {/* Logo Section */}
          <div 
            className="flex items-center space-x-3 cursor-pointer group"
            onClick={() => setCurrentView("browse")}
          >
            <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white font-bold text-lg group-hover:bg-slate-800 transition-colors shadow-md">
              PM
            </div>
            <div>
              <h1 className="font-sans font-bold text-lg tracking-tight text-slate-900 leading-none">
                {getTranslation(language, "appName")}
              </h1>
              <span className="text-xs text-slate-400 font-medium tracking-wide">
                {getTranslation(language, "appNameSub")}
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex space-x-1 lg:space-x-2">
            <button
              onClick={() => setCurrentView("browse")}
              className={`flex items-center space-x-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                currentView === "browse" 
                  ? "bg-slate-100 text-slate-900 font-semibold" 
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Compass className="w-4 h-4" />
              <span>{getTranslation(language, "browse")}</span>
            </button>

            <button
              onClick={() => setCurrentView("compare")}
              className={`flex items-center space-x-1 px-3 py-2 rounded-lg text-sm font-medium transition-all relative ${
                currentView === "compare" 
                  ? "bg-slate-100 text-slate-900 font-semibold" 
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <ArrowLeftRight className="w-4 h-4" />
              <span>{getTranslation(language, "compare")}</span>
              {compareCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center font-bold">
                  {compareCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setCurrentView("ai-advisor")}
              className={`flex items-center space-x-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                currentView === "ai-advisor" 
                  ? "bg-slate-100 text-slate-900 font-semibold" 
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <span className="text-sm">✨</span>
              <span>{getTranslation(language, "aiAdvisor")}</span>
            </button>

            <button
              onClick={() => setCurrentView("import-center")}
              className={`flex items-center space-x-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                currentView === "import-center" 
                  ? "bg-slate-100 text-slate-900 font-semibold" 
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Compass className="w-4 h-4 text-indigo-500" />
              <span>{getTranslation(language, "importCenter")}</span>
            </button>

            <button
              onClick={() => setCurrentView("dashboard")}
              className={`flex items-center space-x-1 px-3 py-2 rounded-lg text-sm font-medium transition-all relative ${
                currentView === "dashboard" 
                  ? "bg-slate-100 text-slate-900 font-semibold" 
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Settings2 className="w-4 h-4" />
              <span>{getTranslation(language, "dashboard")}</span>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-2.5 h-2.5 rounded-full flex items-center justify-center"></span>
              )}
            </button>
          </nav>

          {/* Settings & Switches */}
          <div className="flex items-center space-x-3">
            
            {/* User Session Chip */}
            {authenticatedUser && (
              <div className="flex items-center space-x-2 border border-slate-100 rounded-xl bg-slate-50/70 p-1.5 px-2.5" id="user-session-chip">
                <div className="w-5 h-5 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-[10px] uppercase">
                  {authenticatedUser.fullName.charAt(0)}
                </div>
                <div className="hidden lg:block text-left max-w-[100px]">
                  <p className="text-[9px] text-slate-400 font-bold truncate leading-none">
                    {isZh ? "已登录" : "Logged in"}
                  </p>
                  <p className="text-[10px] text-slate-700 font-extrabold truncate leading-tight mt-0.5" title={authenticatedUser.fullName}>
                    {authenticatedUser.fullName}
                  </p>
                </div>
                <button
                  onClick={onLogout}
                  className="text-[10px] text-red-500 hover:text-red-700 font-extrabold ml-1 hover:bg-red-50 px-1.5 py-0.5 rounded-md transition-colors cursor-pointer"
                  title={isZh ? "退出登录" : "Log Out"}
                >
                  {isZh ? "退出" : "Logout"}
                </button>
              </div>
            )}

            {/* Language Toggler */}
            <button
              onClick={() => setLanguage(isZh ? "en" : "zh")}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 transition-all hover:border-slate-300"
            >
              <Globe className="w-3.5 h-3.5 text-slate-500" />
              <span>{isZh ? "English" : "简体中文"}</span>
            </button>

            {/* Role Switcher */}
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/50">
              <button
                onClick={() => {
                  setActiveRole("buyer");
                  setCurrentView("browse");
                }}
                className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeRole === "buyer"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
                title={getTranslation(language, "buyer")}
              >
                <User className="w-3 h-3" />
                <span className="hidden sm:inline">
                  {isZh ? "买家" : "Buyer"}
                </span>
              </button>
              
              <button
                onClick={() => {
                  setActiveRole("manufacturer");
                  setCurrentView("dashboard");
                }}
                className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeRole === "manufacturer"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
                title={getTranslation(language, "manufacturer")}
              >
                <Building2 className="w-3 h-3" />
                <span className="hidden sm:inline">
                  {isZh ? "工厂" : "Factory"}
                </span>
              </button>

              <button
                onClick={() => {
                  setActiveRole("admin");
                  setCurrentView("dashboard");
                }}
                className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeRole === "admin"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
                title={getTranslation(language, "admin")}
              >
                <ShieldCheck className="w-3 h-3" />
                <span className="hidden sm:inline">
                  {isZh ? "后台" : "Admin"}
                </span>
              </button>
            </div>

          </div>

        </div>
      </div>
      
      {/* Visual Indicator of Active Portal view */}
      <div className="bg-slate-50 border-t border-slate-100 py-2 px-4 text-center text-xs text-slate-500 flex justify-center items-center space-x-1 font-medium">
        <span>{getTranslation(language, "activeRole")}:</span>
        <span className="bg-slate-900 text-white font-semibold px-2 py-0.5 rounded-full text-[10px] tracking-wide uppercase">
          {getTranslation(language, activeRole)}
        </span>
        <span className="hidden md:inline text-slate-400">|</span>
        <span className="hidden md:inline text-slate-400">
          {getTranslation(language, activeRole === "buyer" ? "buyerRoleDesc" : activeRole === "manufacturer" ? "manufacturerRoleDesc" : "adminRoleDesc")}
        </span>
      </div>
    </header>
  );
}
