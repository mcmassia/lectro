'use client';

import { useEffect } from 'react';
import { useAppStore } from '@/stores/appStore';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const { theme, setTheme } = useAppStore();

    useEffect(() => {
        // Initialize theme on mount
        const savedTheme = localStorage.getItem('lectro-storage');
        if (savedTheme) {
            try {
                const parsed = JSON.parse(savedTheme);
                if (parsed.state?.theme) {
                    setTheme(parsed.state.theme);
                }
            } catch (e) {
                // Use default
                setTheme('system');
            }
        } else {
            setTheme('system');
        }

        // Listen for system theme changes
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = () => {
            if (theme === 'system') {
                setTheme('system');
            }
        };

        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, [theme, setTheme]);

    return <>{children}</>;
}
