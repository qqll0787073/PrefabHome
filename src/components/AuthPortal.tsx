import React, { useState, useEffect } from "react";
import { Language, UserRole } from "../types";
import { motion } from "motion/react";
import { ShieldCheck, User, Building2, Lock, Mail, FileText, UserPlus, LogIn, AlertCircle, CheckCircle } from "lucide-react";

interface AuthPortalProps {
  language: Language;
  role: UserRole;
  onLoginSuccess: (username: string, fullName: string, email: string) => void;
}

interface UserAccount {
  username: string;
  password: string;
  role: UserRole;
  email: string;
  fullName: string;
  company?: string;
}

const DEFAULT_USERS: UserAccount[] = [
  {
    username: "buyer",
    password: "password123",
    role: "buyer",
    email: "buyer@prefab.com",
    fullName: "Mark Harrison"
  },
  {
    username: "factory",
    password: "password123",
    role: "manufacturer",
    email: "factory@prefab.com",
    fullName: "Lin Wei",
    company: "Dongying Modular Co."
  },
  {
    username: "admin",
    password: "password123",
    role: "admin",
    email: "admin@prefab.com",
    fullName: "System Administrator"
  }
];

export default function AuthPortal({ language, role, onLoginSuccess }: AuthPortalProps) {
  const isZh = language === "zh";
  const [isLogin, setIsLogin] = useState<boolean>(true);

  // Form states
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [company, setCompany] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // UI feedback states
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Initialize accounts database
  const getAccounts = (): UserAccount[] => {
    try {
      const stored = localStorage.getItem("prefab_registered_accounts");
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error("Error reading accounts", e);
    }
    // Write defaults
    localStorage.setItem("prefab_registered_accounts", JSON.stringify(DEFAULT_USERS));
    return DEFAULT_USERS;
  };

  // Reset states on mode switch
  useEffect(() => {
    setUsername("");
    setPassword("");
    setEmail("");
    setFullName("");
    setCompany("");
    setConfirmPassword("");
    setError(null);
    setSuccess(null);
  }, [isLogin, role]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !password) {
      setError(isZh ? "请输入用户名和密码。" : "Please enter both username and password.");
      return;
    }

    const accounts = getAccounts();
    // Case-insensitive match on username or email
    const found = accounts.find(
      (acc) =>
        acc.role === role &&
        (acc.username.toLowerCase() === username.trim().toLowerCase() ||
          acc.email.toLowerCase() === username.trim().toLowerCase())
    );

    if (!found) {
      setError(
        isZh
          ? `未找到该角色的账户。试用账号：${role} 密码：password123`
          : `Account not found for this role. Try default: '${role}' with password 'password123'`
      );
      return;
    }

    if (found.password !== password) {
      setError(isZh ? "密码不正确，请重试。" : "Incorrect password. Please try again.");
      return;
    }

    onLoginSuccess(found.username, found.fullName, found.email);
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Validation
    if (!username.trim() || !password || !email.trim() || !fullName.trim()) {
      setError(isZh ? "所有带星号的字段均为必填项。" : "All starred fields are required.");
      return;
    }

    if (password.length < 6) {
      setError(isZh ? "密码长度必须至少为 6 位字符。" : "Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError(isZh ? "两次输入的密码不一致。" : "Passwords do not match.");
      return;
    }

    if (role === "manufacturer" && !company.trim()) {
      setError(isZh ? "制造商账户必须填写工厂/公司名称。" : "Manufacturer account requires a company/factory name.");
      return;
    }

    const accounts = getAccounts();

    // Check if duplicate username or email within same role
    const exists = accounts.some(
      (acc) =>
        acc.role === role &&
        (acc.username.toLowerCase() === username.trim().toLowerCase() ||
          acc.email.toLowerCase() === email.trim().toLowerCase())
    );

    if (exists) {
      setError(isZh ? "该用户名或邮箱已被注册。" : "This username or email is already registered.");
      return;
    }

    // Create account
    const newAccount: UserAccount = {
      username: username.trim(),
      password,
      role,
      email: email.trim(),
      fullName: fullName.trim(),
      ...(role === "manufacturer" ? { company: company.trim() } : {})
    };

    const updated = [...accounts, newAccount];
    localStorage.setItem("prefab_registered_accounts", JSON.stringify(updated));

    setSuccess(isZh ? "注册成功！现在您可以登录了。" : "Registration successful! You can now log in.");
    
    // Auto populate and toggle to login after 1.5s
    setTimeout(() => {
      setIsLogin(true);
      setPassword("");
      setConfirmPassword("");
      setSuccess(null);
    }, 1500);
  };

  // Content descriptors for visual side-banner
  const roleMeta = {
    buyer: {
      title_en: "Buyer Workspace",
      title_cn: "买家独立工作台",
      desc_en: "Browse verified custom modular factories, simulate full logistics costs, and manage structural inquiries.",
      desc_cn: "在这里寻找经过认证的中国模块化房源、测算通关运费、管理工厂询盘和进行实时双语沟通。"
    },
    manufacturer: {
      title_en: "Manufacturer Hub",
      title_cn: "中国预制厂控制台",
      desc_en: "List ASTM/CE-certified capsule homes, respond with official itemized quotes, and handle U.S. client inquiries.",
      desc_cn: "发布符合美标/欧标的集成房屋，管理海外买家询价，在线拟定并发送正式的外贸报价单。"
    },
    admin: {
      title_en: "Marketplace Overseer",
      title_cn: "平台超级监管中心",
      desc_en: "Review manufacturer quality seals, monitor structural safety compliance, and audit system logs.",
      desc_cn: "审核供应商资质、监控产品合规性报告，全览平台询价流程并管理系统审计日志。"
    }
  }[role];

  return (
    <div className="max-w-4xl mx-auto my-12 bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[500px]" id="auth-portal-card">
      
      {/* Visual Banner Left Column */}
      <div className="md:col-span-5 bg-slate-900 text-white p-8 flex flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-950 via-slate-900 to-slate-950 opacity-90 z-0" />
        
        <div className="relative z-10 space-y-6">
          <div className="inline-flex items-center space-x-2 bg-indigo-500/20 text-indigo-300 px-3 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase">
            {role === "buyer" && <User className="w-3.5 h-3.5" />}
            {role === "manufacturer" && <Building2 className="w-3.5 h-3.5" />}
            {role === "admin" && <ShieldCheck className="w-3.5 h-3.5" />}
            <span>{isZh ? roleMeta.title_cn : roleMeta.title_en}</span>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-black tracking-tight font-sans">
              {isZh ? "安全接入门户" : "Secure Portal Gateway"}
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              {isZh ? roleMeta.desc_cn : roleMeta.desc_en}
            </p>
          </div>
        </div>

        {/* Demo Helper box */}
        <div className="relative z-10 bg-white/5 border border-white/10 rounded-2xl p-4 mt-6">
          <span className="text-[10px] font-black tracking-wider uppercase text-amber-400 block mb-1">
            💡 {isZh ? "平台测试账号" : "Quick Test Account"}
          </span>
          <p className="text-[11px] text-slate-300">
            {isZh ? "用户名 / 邮箱:" : "Username:"} <code className="text-white font-mono font-bold bg-white/10 px-1 rounded">{role}</code>
          </p>
          <p className="text-[11px] text-slate-300 mt-1">
            {isZh ? "密码:" : "Password:"} <code className="text-white font-mono font-bold bg-white/10 px-1 rounded">password123</code>
          </p>
        </div>
      </div>

      {/* Forms Area Right Column */}
      <div className="md:col-span-7 p-8 flex flex-col justify-center">
        
        {/* Switch tab */}
        <div className="flex border-b border-slate-100 pb-4 mb-6">
          <button
            type="button"
            onClick={() => setIsLogin(true)}
            className={`flex items-center space-x-1 px-4 py-2 text-xs font-bold transition-all relative ${
              isLogin ? "text-indigo-600" : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <LogIn className="w-4 h-4" />
            <span>{isZh ? "账号登录" : "Account Login"}</span>
            {isLogin && <motion.div layoutId="activeTabUnderline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />}
          </button>

          <button
            type="button"
            onClick={() => setIsLogin(false)}
            className={`flex items-center space-x-1 px-4 py-2 text-xs font-bold transition-all relative ${
              !isLogin ? "text-indigo-600" : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>{isZh ? "免费注册" : "Register Account"}</span>
            {!isLogin && <motion.div layoutId="activeTabUnderline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />}
          </button>
        </div>

        {/* Action feedback notifications */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-xl flex items-start space-x-2 text-xs mb-4">
            <AlertCircle className="w-4.5 h-4.5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-800 p-3 rounded-xl flex items-start space-x-2 text-xs mb-4 animate-pulse">
            <CheckCircle className="w-4.5 h-4.5 shrink-0 mt-0.5" />
            <span>{success}</span>
          </div>
        )}

        {/* Form elements */}
        {isLogin ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                {isZh ? "用户名或注册邮箱" : "Username or Email Address"}
              </label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs outline-hidden focus:ring-1 focus:ring-indigo-500"
                  placeholder={role === "buyer" ? "buyer" : role === "manufacturer" ? "factory" : "admin"}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                {isZh ? "安全密码" : "Account Password"}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs outline-hidden focus:ring-1 focus:ring-indigo-500"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2.5 rounded-xl transition-all shadow-sm cursor-pointer"
            >
              {isZh ? `登录至${role === "buyer" ? "买家" : role === "manufacturer" ? "工厂" : "后台"}门户` : `Sign In to ${role === "buyer" ? "Buyer" : role === "manufacturer" ? "Factory" : "Admin"} Portal`}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="space-y-3.5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  {isZh ? "用户名 *" : "Username *"}
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-hidden focus:ring-1 focus:ring-indigo-500"
                  placeholder="e.g. janesmith"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  {isZh ? "注册邮箱 *" : "Email Address *"}
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-hidden focus:ring-1 focus:ring-indigo-500"
                  placeholder="name@domain.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  {isZh ? "真实姓名 *" : "Full Name *"}
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-hidden focus:ring-1 focus:ring-indigo-500"
                  placeholder="e.g. Jane Smith"
                />
              </div>

              {role === "manufacturer" && (
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    {isZh ? "工厂/公司名称 *" : "Factory/Company Name *"}
                  </label>
                  <input
                    type="text"
                    required
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-hidden focus:ring-1 focus:ring-indigo-500"
                    placeholder="e.g. Taishan Prefabs Ltd."
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  {isZh ? "密码 (至少6位) *" : "Password (min 6) *"}
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-hidden focus:ring-1 focus:ring-indigo-500"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  {isZh ? "确认密码 *" : "Confirm Password *"}
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-hidden focus:ring-1 focus:ring-indigo-500"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2.5 rounded-xl transition-all shadow-xs cursor-pointer mt-2"
            >
              {isZh ? `注册新${role === "buyer" ? "买家" : role === "manufacturer" ? "工厂" : "后台"}账户` : `Sign Up as ${role === "buyer" ? "Buyer" : role === "manufacturer" ? "Factory" : "Admin"}`}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
