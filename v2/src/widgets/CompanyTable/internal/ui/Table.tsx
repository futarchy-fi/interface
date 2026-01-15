"use client";

import React from "react";
import { Company, CompanyTableProps } from "../../types";
import { motion } from "framer-motion";
import { ArrowRight, Wallet, Activity } from "lucide-react";
import clsx from "clsx";

import { COMPANY_TABLE_MESSAGES } from "@/config/messages";

interface InternalProps extends CompanyTableProps {
    onSelect: (companyId: string) => void;
}

export const CompanyTableUI: React.FC<InternalProps> = ({ companies, isLoading, onSelect }) => {
    if (isLoading) {
        return (
            <div className="w-full h-64 flex items-center justify-center text-slate-500 animate-pulse">
                {COMPANY_TABLE_MESSAGES.LOADING}
            </div>
        );
    }

    return (
        <div className="w-full overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur-xl shadow-2xl">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-gradient-to-r from-slate-900 via-slate-900 to-slate-900/50">
                <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
                    {COMPANY_TABLE_MESSAGES.HEADERS.TITLE}
                </h2>
                <span className="px-3 py-1 bg-slate-800 rounded-full text-xs text-slate-400 border border-slate-700">
                    {companies.length} {COMPANY_TABLE_MESSAGES.HEADERS.SUBTITLE_SUFFIX}
                </span>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="text-slate-400 text-sm uppercase tracking-wider border-b border-slate-800/60 bg-slate-900/30">
                            <th className="p-5 font-medium">{COMPANY_TABLE_MESSAGES.HEADERS.COMPANY}</th>
                            <th className="p-5 font-medium">{COMPANY_TABLE_MESSAGES.HEADERS.DESCRIPTION}</th>
                            <th className="p-5 font-medium text-right">{COMPANY_TABLE_MESSAGES.HEADERS.PROPOSALS}</th>
                            <th className="p-5 font-medium text-right">{COMPANY_TABLE_MESSAGES.HEADERS.TREASURY}</th>
                            <th className="p-5 font-medium text-right">{COMPANY_TABLE_MESSAGES.HEADERS.ACTION}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                        {companies.map((company, index) => (
                            <motion.tr
                                key={company.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                                whileHover={{ backgroundColor: "rgba(30, 41, 59, 0.5)" }}
                                className="group cursor-pointer transition-colors duration-200"
                                onClick={() => onSelect(company.id)}
                            >
                                <td className="p-5">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-lg font-bold text-white shadow-inner border border-slate-600">
                                            {company.tokenSymbol[0]}
                                        </div>
                                        <div>
                                            <div className="font-semibold text-slate-100 group-hover:text-blue-400 transition-colors">
                                                {company.name}
                                            </div>
                                            <div className="text-xs text-slate-500">{company.tokenSymbol}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="p-5 text-slate-400 text-sm max-w-xs truncate">
                                    {company.description}
                                </td>
                                <td className="p-5 text-right">
                                    <div className="flex items-center justify-end gap-2 text-slate-300">
                                        <Activity size={16} className="text-emerald-500" />
                                        {company.activeProposals}
                                    </div>
                                </td>
                                <td className="p-5 text-right">
                                    <div className="flex items-center justify-end gap-2 text-slate-300">
                                        <Wallet size={16} className="text-purple-500" />
                                        {company.treasury}
                                    </div>
                                </td>
                                <td className="p-5 text-right">
                                    <button className="p-2 rounded-full bg-slate-800 text-slate-400 group-hover:bg-blue-500 group-hover:text-white transition-all duration-300 shadow-lg">
                                        <ArrowRight size={18} />
                                    </button>
                                </td>
                            </motion.tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
