"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wallet, LayoutDashboard, PieChart, Bell } from "lucide-react";
import { ConnectButton } from '@rainbow-me/rainbowkit';
import clsx from "clsx";

export const Header = () => {
    const pathname = usePathname();

    const navItems = [
        { name: "Dashboard", href: "/", icon: LayoutDashboard },
        { name: "Portfolio", href: "/portfolio", icon: PieChart },
    ];

    return (
        <header className="fixed top-0 left-0 right-0 z-50 h-20 px-8 flex items-center justify-between border-b border-white/5 bg-[#0a0a0a]/80 backdrop-blur-xl">
            {/* Logo */}
            <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-blue-900/20">
                    F
                </div>
                <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                    Futarchy
                </span>
            </div>

            {/* Navigation */}
            <nav className="hidden md:flex items-center gap-1 bg-white/5 p-1 rounded-full border border-white/5">
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    const Icon = item.icon;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={clsx(
                                "px-6 py-2.5 rounded-full text-sm font-medium transition-all duration-200 flex items-center gap-2",
                                isActive
                                    ? "bg-slate-800 text-white shadow-lg"
                                    : "text-slate-400 hover:text-white hover:bg-white/5"
                            )}
                        >
                            <Icon size={16} />
                            {item.name}
                        </Link>
                    );
                })}
            </nav>

            {/* Right Side: Wallet & Actions */}
            <div className="flex items-center gap-4">
                {/* Notifications (Mock) */}
                <button className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
                    <Bell size={18} />
                </button>

                {/* Connect Wallet */}
                <ConnectButton />
            </div>
        </header>
    );
};
