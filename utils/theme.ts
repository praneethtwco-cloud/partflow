export const themeColors = {
    indigo: {
        name: 'Indigo',
        hex: '#4f46e5',
        bg: 'bg-indigo-600',
        bgHover: 'hover:bg-indigo-700',
        bgSoft: 'bg-indigo-50',
        bgSoftHover: 'hover:bg-indigo-100',
        text: 'text-indigo-600',
        textDark: 'text-indigo-900',
        border: 'border-indigo-200',
        ring: 'focus:ring-indigo-500',
        gradient: 'from-indigo-600 to-indigo-800',
        shadow: 'shadow-indigo-200'
    },
    blue: {
        name: 'Ocean',
        hex: '#2563eb',
        bg: 'bg-blue-600',
        bgHover: 'hover:bg-blue-700',
        bgSoft: 'bg-blue-50',
        bgSoftHover: 'hover:bg-blue-100',
        text: 'text-blue-600',
        textDark: 'text-blue-900',
        border: 'border-blue-200',
        ring: 'focus:ring-blue-500',
        gradient: 'from-blue-600 to-blue-800',
        shadow: 'shadow-blue-200'
    },
    violet: {
        name: 'Royal',
        hex: '#7c3aed',
        bg: 'bg-violet-600',
        bgHover: 'hover:bg-violet-700',
        bgSoft: 'bg-violet-50',
        bgSoftHover: 'hover:bg-violet-100',
        text: 'text-violet-600',
        textDark: 'text-violet-900',
        border: 'border-violet-200',
        ring: 'focus:ring-violet-500',
        gradient: 'from-violet-600 to-violet-800',
        shadow: 'shadow-violet-200'
    },
    emerald: {
        name: 'Emerald',
        hex: '#059669',
        bg: 'bg-emerald-600',
        bgHover: 'hover:bg-emerald-700',
        bgSoft: 'bg-emerald-50',
        bgSoftHover: 'hover:bg-emerald-100',
        text: 'text-emerald-600',
        textDark: 'text-emerald-900',
        border: 'border-emerald-200',
        ring: 'focus:ring-emerald-500',
        gradient: 'from-emerald-600 to-emerald-800',
        shadow: 'shadow-emerald-200'
    },
    rose: {
        name: 'Rose',
        hex: '#e11d48',
        bg: 'bg-rose-600',
        bgHover: 'hover:bg-rose-700',
        bgSoft: 'bg-rose-50',
        bgSoftHover: 'hover:bg-rose-100',
        text: 'text-rose-600',
        textDark: 'text-rose-900',
        border: 'border-rose-200',
        ring: 'focus:ring-rose-500',
        gradient: 'from-rose-600 to-rose-800',
        shadow: 'shadow-rose-200'
    },
    amber: {
        name: 'Amber',
        hex: '#f59e0b',
        bg: 'bg-amber-500', // Amber 600 is too dark/orange sometimes
        bgHover: 'hover:bg-amber-600',
        bgSoft: 'bg-amber-50',
        bgSoftHover: 'hover:bg-amber-100',
        text: 'text-amber-600',
        textDark: 'text-amber-900',
        border: 'border-amber-200',
        ring: 'focus:ring-amber-500',
        gradient: 'from-amber-500 to-amber-700',
        shadow: 'shadow-amber-200'
    },
    slate: {
        name: 'Graphite',
        hex: '#334155',
        bg: 'bg-slate-700',
        bgHover: 'hover:bg-slate-800',
        bgSoft: 'bg-slate-100',
        bgSoftHover: 'hover:bg-slate-200',
        text: 'text-slate-700',
        textDark: 'text-slate-900',
        border: 'border-slate-300',
        ring: 'focus:ring-slate-500',
        gradient: 'from-slate-700 to-slate-900',
        shadow: 'shadow-slate-300'
    }
};

export type ThemeColor = keyof typeof themeColors;
