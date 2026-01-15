"use client";

import React from "react";
import { CompanyDetail } from "../../types";
import { ArrowLeft, Globe, Wallet, ChevronRight, Search, SlidersHorizontal, Users, FileText, ExternalLink } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

import { COMPANY_DETAIL_MESSAGES } from "@/config/messages";

interface InternalProps {
    company: any; // Relaxed type for now
    isLoading: boolean;
}

export const CompanyDetailUI: React.FC<InternalProps> = ({ company, isLoading }) => {
    if (isLoading || !company) {
        return (
            <div className="w-full h-96 flex items-center justify-center text-slate-500 animate-pulse">
                {COMPANY_DETAIL_MESSAGES.LOADING}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-8 pb-12">
            {/* 1. Hero / Header Section */}
            <div className="relative w-full rounded-3xl overflow-hidden border border-slate-800 bg-slate-900/60 shadow-2xl">
                {/* Banner Image Area */}
                <div className="h-48 bg-gradient-to-r from-blue-900/40 to-slate-900/40 w-full relative">
                    <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1639762681485-074b7f938ba0?q=80&w=2832&auto=format&fit=crop')] bg-cover bg-center opacity-30 mix-blend-overlay"></div>
                    <div className="absolute top-4 left-4">
                        <Link href="/" className="inline-flex items-center gap-2 text-white/50 hover:text-white px-3 py-1.5 rounded-full bg-black/20 backdrop-blur-md transition-colors text-xs font-medium border border-white/5">
                            <ArrowLeft size={14} /> {COMPANY_DETAIL_MESSAGES.BACK_TO_DASHBOARD}
                        </Link>
                    </div>
                </div>

                <div className="px-8 pb-8 relative">
                    <div className="flex flex-col md:flex-row items-end gap-6 -mt-12">
                        {/* Logo */}
                        <div className="w-32 h-32 rounded-3xl bg-slate-950 border-4 border-slate-900/60 shadow-xl flex items-center justify-center text-4xl font-bold text-white relative z-10">
                            {company.tokenSymbol[0]}
                        </div>

                        {/* Org Info */}
                        <div className="flex-1 pb-2">
                            <div className="flex items-center gap-3 mb-1">
                                <h1 className="text-3xl font-bold text-white">{company.name}</h1>
                                <a href={company.website} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-white transition-colors">
                                    <Globe size={16} />
                                </a>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-xs font-medium text-slate-300">
                                    <img src="/eth-logo.svg" className="w-3 h-3 grayscale opacity-60" alt="" /> Ethereum
                                </span>
                                <span className="px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-xs font-medium text-slate-300">
                                    {company.tokenSymbol}
                                </span>
                                <span className="px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-xs font-medium text-slate-300">
                                    10B Supply
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 hover:bg-slate-800/40 transition-colors group cursor-pointer">
                    <div className="flex justify-between items-start mb-4">
                        <span className="text-slate-400 font-medium text-sm">{COMPANY_DETAIL_MESSAGES.STATS.DELEGATES}</span>
                        <ChevronRight size={16} className="text-slate-600 group-hover:text-white transition-colors" />
                    </div>
                    <div className="text-3xl font-bold text-white mb-1">2.98K</div>
                    <div className="text-xs text-slate-500">174.23K {COMPANY_DETAIL_MESSAGES.STATS.TOKEN_HOLDERS}</div>
                </div>

                <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 hover:bg-slate-800/40 transition-colors group cursor-pointer">
                    <div className="flex justify-between items-start mb-4">
                        <span className="text-slate-400 font-medium text-sm">{COMPANY_DETAIL_MESSAGES.STATS.PROPOSALS}</span>
                        <ChevronRight size={16} className="text-slate-600 group-hover:text-white transition-colors" />
                    </div>
                    <div className="text-3xl font-bold text-white mb-1">{company.activeProposals}</div>
                    <div className="text-xs text-slate-500">{COMPANY_DETAIL_MESSAGES.STATS.ACTIVE_PROPOSALS}</div>
                </div>

                <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 hover:bg-slate-800/40 transition-colors group cursor-pointer">
                    <div className="flex justify-between items-start mb-4">
                        <span className="text-slate-400 font-medium text-sm">{COMPANY_DETAIL_MESSAGES.STATS.TREASURY}</span>
                        <ChevronRight size={16} className="text-slate-600 group-hover:text-white transition-colors" />
                    </div>
                    <div className="text-3xl font-bold text-white mb-1">{company.treasury}</div>
                    <div className="text-xs text-slate-500">1 {COMPANY_DETAIL_MESSAGES.STATS.TREASURY_SOURCE}</div>
                </div>
            </div>

            {/* 3. Main Content Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                {/* Left Column: Proposals List (8 cols) */}
                <div className="lg:col-span-8 flex flex-col gap-6">
                    {/* Controls */}
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                        <div className="flex items-center gap-6 border-b border-slate-800 w-full sm:w-auto">
                            <button className="pb-3 border-b-2 border-slate-100 text-slate-100 font-medium text-sm">{COMPANY_DETAIL_MESSAGES.TABS.PROPOSALS}</button>
                            <button className="pb-3 border-b-2 border-transparent text-slate-500 hover:text-slate-300 transition-colors font-medium text-sm">{COMPANY_DETAIL_MESSAGES.TABS.NEW}</button>
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <div className="relative flex-1 sm:w-64">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input
                                    type="text"
                                    placeholder={COMPANY_DETAIL_MESSAGES.SEARCH_PLACEHOLDER}
                                    className="w-full bg-slate-900/50 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-slate-600 transition-colors"
                                />
                            </div>
                            <button className="p-2 bg-slate-900/50 border border-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
                                <SlidersHorizontal size={16} />
                            </button>
                        </div>
                    </div>

                    {/* Proposals List Card */}
                    <div className="bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden">
                        <div className="divide-y divide-slate-800/50">
                            {company.proposals?.map((proposal: any) => (
                                <Link
                                    key={proposal.id}
                                    href={`/markets/${proposal.id}`}
                                    className="block p-5 hover:bg-slate-800/30 transition-colors group"
                                >
                                    <div className="flex flex-col gap-3">
                                        <div className="flex justify-between items-start">
                                            <h3 className="text-lg font-semibold text-slate-200 group-hover:text-blue-400 transition-colors line-clamp-2">
                                                {proposal.title}
                                            </h3>
                                            <span className={`shrink-0 px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${proposal.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                                }`}>
                                                {proposal.status}
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-between mt-2">
                                            <div className="flex items-center gap-4">
                                                <div className="flex -space-x-2">
                                                    {[1, 2, 3].map(i => (
                                                        <div key={i} className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[8px] text-slate-400">
                                                            U{i}
                                                        </div>
                                                    ))}
                                                </div>
                                                <span className="text-xs text-slate-500">{COMPANY_DETAIL_MESSAGES.PROPOSAL_CARD.ENDS} {proposal.endDate}</span>
                                            </div>

                                            <div className="text-right">
                                                <div className="text-sm font-medium text-slate-300">{proposal.volume} {COMPANY_DETAIL_MESSAGES.PROPOSAL_CARD.VOL}</div>
                                                <div className="text-xs text-slate-500">459 {COMPANY_DETAIL_MESSAGES.PROPOSAL_CARD.ADDRESSES}</div>
                                            </div>
                                        </div>

                                        {/* Voting Bar */}
                                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden flex mt-1">
                                            <div className="h-full bg-emerald-500 w-[65%]"></div>
                                            <div className="h-full bg-red-500 w-[5%]"></div>
                                            <div className="h-full bg-slate-600 w-[30%]"></div>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Column: Sidebar (4 cols) */}
                <div className="lg:col-span-4 flex flex-col gap-6">

                    {/* About Card */}
                    <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5">
                        <div className="flex justify-between items-center mb-3">
                            <h4 className="font-semibold text-slate-200">{COMPANY_DETAIL_MESSAGES.SIDEBAR.ABOUT} {company.name}</h4>
                            <Users size={16} className="text-slate-500" />
                        </div>
                        <p className="text-sm text-slate-400 leading-relaxed mb-4">
                            {company.fullDescription}
                        </p>
                        <div className="flex gap-2">
                            <button className="flex-1 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition-colors">
                                {COMPANY_DETAIL_MESSAGES.SIDEBAR.WEBSITE}
                            </button>
                            <button className="flex-1 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition-colors">
                                {COMPANY_DETAIL_MESSAGES.SIDEBAR.TWITTER}
                            </button>
                        </div>
                    </div>

                    {/* My Voting Power */}
                    <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5">
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="font-semibold text-slate-200">{COMPANY_DETAIL_MESSAGES.SIDEBAR.VOTING_POWER}</h4>
                            <Wallet size={16} className="text-slate-500" />
                        </div>
                        <div className="mb-4">
                            <div className="text-2xl font-bold text-white">0</div>
                            <div className="text-xs text-slate-500">{company.tokenSymbol}</div>
                        </div>
                        <button className="w-full py-2 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 border border-indigo-500/30 text-sm font-medium transition-colors">
                            {COMPANY_DETAIL_MESSAGES.SIDEBAR.VIEW_DETAILS}
                        </button>
                    </div>

                    {/* Quick Access */}
                    <div className="bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden">
                        <button className="w-full flex items-center justify-between p-4 hover:bg-slate-800/40 text-left border-b border-slate-800 last:border-0 transition-colors group">
                            <div className="flex items-center gap-3">
                                <FileText size={16} className="text-slate-500 group-hover:text-slate-300" />
                                <span className="text-sm font-medium text-slate-300 group-hover:text-white">{COMPANY_DETAIL_MESSAGES.SIDEBAR.CONTRACTS}</span>
                            </div>
                            <ChevronRight size={14} className="text-slate-600 group-hover:text-slate-400" />
                        </button>
                        <button className="w-full flex items-center justify-between p-4 hover:bg-slate-800/40 text-left transition-colors group">
                            <div className="flex items-center gap-3">
                                <Users size={16} className="text-slate-500 group-hover:text-slate-300" />
                                <span className="text-sm font-medium text-slate-300 group-hover:text-white">{COMPANY_DETAIL_MESSAGES.SIDEBAR.EDITORS}</span>
                            </div>
                            <ChevronRight size={14} className="text-slate-600 group-hover:text-slate-400" />
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
};

