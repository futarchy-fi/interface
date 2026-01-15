"use client";

import React from "react";
import { BarChart2, BookOpen, Activity, Briefcase, LayoutDashboard } from "lucide-react";

export const MobileNavWidget = () => {
    const [activeSection, setActiveSection] = React.useState<string>('hero');

    React.useEffect(() => {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    setActiveSection(entry.target.id);
                }
            });
        }, {
            rootMargin: '-50% 0px -50% 0px' // Center of screen triggers
        });

        const sections = ['hero', 'chart', 'activity', 'position']; // Removed orders
        sections.forEach(id => {
            const el = document.getElementById(id);
            if (el) observer.observe(el);
        });

        return () => observer.disconnect();
    }, []);

    const scrollToSection = (id: string) => {
        const element = document.getElementById(id);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            setActiveSection(id);
        }
    };

    const navItems = [
        { id: 'hero', label: 'Overview', icon: <LayoutDashboard size={18} /> },
        { id: 'chart', label: 'Chart', icon: <BarChart2 size={18} /> },
        { id: 'activity', label: 'Trades', icon: <Activity size={18} /> },
        { id: 'position', label: 'Position', icon: <Briefcase size={18} /> },
    ];

    return (
        <div className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-full shadow-2xl p-2 max-w-[90vw]">
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar scroll-smooth px-2">
                {navItems.map((item) => {
                    const isActive = activeSection === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => scrollToSection(item.id)}
                            className={`flex items-center gap-2 px-4 py-3 rounded-full whitespace-nowrap transition-all active:scale-95 ${isActive
                                ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                                : "hover:bg-slate-800 text-slate-400 hover:text-white"
                                }`}
                        >
                            {item.icon}
                            <span className={`text-xs ${isActive ? "font-bold" : "font-medium"}`}>{item.label}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
