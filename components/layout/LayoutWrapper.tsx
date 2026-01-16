'use client';

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { LeftSidebar } from './LeftSidebar';
import { RightSidebar } from './RightSidebar';

interface LayoutWrapperProps {
    children: ReactNode;
}

export function LayoutWrapper({ children }: LayoutWrapperProps) {
    const pathname = usePathname();
    const isReaderMode = pathname?.startsWith('/reader');

    if (isReaderMode) {
        // En modo lector, el contenido ocupa todo el espacio disponible
        return (
            <div className="main-layout reader-mode">
                <main className="content-area">
                    {children}
                </main>

                <style jsx>{`
                    .main-layout.reader-mode {
                        display: flex;
                        flex: 1;
                        overflow: hidden;
                        width: 100%;
                    }
                    
                    .main-layout.reader-mode .content-area {
                        flex: 1;
                        display: flex;
                        flex-direction: column;
                        overflow: hidden;
                        background: var(--color-bg-primary);
                        width: 100%;
                        min-width: 0;
                    }
                `}</style>
            </div>
        );
    }

    // Layout normal con sidebars
    return (
        <div className="main-layout">
            <LeftSidebar />
            <main className="content-area">
                {children}
            </main>
            <RightSidebar />
        </div>
    );
}
