import React from 'react';

export const NavButton = ({ active, onClick, icon, label, expanded }: any) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl transition-all duration-200 group ${active
            ? 'bg-gradient-to-r from-purple-500/20 to-blue-500/20 text-white border border-purple-500/20 shadow-lg shadow-purple-500/5'
            : 'text-slate-400 hover:bg-white/5 hover:text-white'
            } ${!expanded && 'justify-center px-2'}`}
    >
        <span className={`transition-transform duration-200 ${active ? 'scale-110 text-purple-400' : 'group-hover:scale-110'}`}>
            {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement, { size: 20 } as any) : null}
        </span>
        {expanded && <span className="font-medium text-sm tracking-wide">{label}</span>}
    </button>
);

export const Skeleton = ({ className }: { className: string }) => (
    <div className={`animate-pulse bg-slate-800/50 rounded-lg ${className}`} />
);

export const StatCard = ({ title, value, icon, color, trend, loading }: any) => {
    const colorStyles: any = {
        purple: { bg: 'bg-purple-500/10', border: 'border-purple-500/20', text: 'text-purple-400', shadow: 'shadow-purple-500/10' },
        blue: { bg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-400', shadow: 'shadow-blue-500/10' },
        emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400', shadow: 'shadow-emerald-500/10' },
    };
    const style = colorStyles[color] || colorStyles.blue;

    if (loading) {
        return (
            <div className={`glass-panel p-6 rounded-2xl border ${style.border} relative overflow-hidden`}>
                <div className="flex justify-between items-start mb-4">
                    <Skeleton className="w-12 h-12" />
                </div>
                <Skeleton className="w-24 h-4 mb-2" />
                <Skeleton className="w-16 h-8" />
            </div>
        );
    }

    return (
        <div className={`glass-panel p-6 rounded-2xl border ${style.border} relative overflow-hidden group hover:scale-[1.02] transition-all duration-300`}>
            <div className={`absolute top-0 right-0 p-32 ${style.bg} blur-3xl rounded-full opacity-20 -mr-16 -mt-16 transition-opacity group-hover:opacity-30`}></div>
            <div className="relative z-10">
                <div className="flex justify-between items-start mb-4">
                    <div className={`p-3 rounded-xl ${style.bg} border ${style.border} ${style.text} shadow-lg ${style.shadow}`}>
                        {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement, { size: 24 } as any) : null}
                    </div>
                    {trend && <span className="bg-emerald-500/10 text-emerald-400 text-xs font-bold px-2 py-1 rounded-full border border-emerald-500/20">{trend}</span>}
                </div>
                <h3 className="text-slate-400 text-sm font-medium uppercase tracking-wider mb-1">{title}</h3>
                <p className="text-3xl font-bold text-white tracking-tight">{value}</p>
            </div>
        </div>
    );
};

import { Menu, X } from 'lucide-react';

export const MobileHeader = ({ onMenuClick, isOpen, brandLogo }: any) => (
    <div className="lg:hidden fixed top-0 left-0 right-0 z-[60] glass-panel border-b border-white/10 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                {brandLogo ? <img src={brandLogo} alt="Logo" className="w-6 h-6 object-contain" /> : <div className="w-4 h-4 bg-white/20 rounded-full" />}
            </div>
            <span className="text-white font-bold tracking-tight">AI Agent</span>
        </div>
        <button
            onClick={onMenuClick}
            className="p-2 text-slate-400 hover:text-white transition-colors"
        >
            {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
    </div>
);
