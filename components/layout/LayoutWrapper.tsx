'use client';

import { ReactNode, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { LeftSidebar } from './LeftSidebar';
import { RightSidebar } from './RightSidebar';
import { ImportModal } from '@/components/library/ImportModal';
import { useAppStore } from '@/stores/appStore';
import { getUser, ensureDefaultUser } from '@/lib/db';

interface LayoutWrapperProps {
    children: ReactNode;
}

export function LayoutWrapper({ children }: LayoutWrapperProps) {
    const pathname = usePathname();
    const isReaderMode = pathname?.startsWith('/reader');
    const isNotesMode = pathname?.startsWith('/notes');
    const { showImportModal, setShowImportModal, currentUser, login } = useAppStore();

    // Session Validation: ensure persisted user matches DB (handles ID migrations)
    useEffect(() => {
        // Run this check always to ensure DB consistency (Fixed ID vs Random ID)
        async function validateSession() {
            try {
                // Ensure default user state in DB is correct (migrates if needed)
                await ensureDefaultUser();

                // If we are logged in as 'mcmassia', check if our session ID matches the DB one
                if (currentUser && currentUser.username === 'mcmassia') {
                    const dbUser = await getUser(currentUser.username);
                    if (dbUser && dbUser.id !== currentUser.id) {
                        console.log('Session mismatch detected (Migration). Updating session...');
                        login(dbUser);
                    }
                }
            } catch (e) {
                console.error('Session validation failed', e);
            }
        }
        validateSession();
    }, [currentUser, login]);

    const importModal = showImportModal && (
        <ImportModal onClose={() => setShowImportModal(false)} />
    );

    if (isReaderMode) {
        // En modo lector, el contenido ocupa todo el espacio disponible
        return (
            <div className="main-layout reader-mode">
                <main className="content-area">
                    {children}
                </main>
                {importModal}

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

    if (isNotesMode) {
        return (
            <div className="main-layout notes-mode h-screen overflow-hidden">
                <main className="flex-1 w-full bg-[var(--color-bg-primary)]">
                    {children}
                </main>
                {importModal}
            </div>
        );
    }

    if (pathname === '/login') {
        return (
            <div className="main-layout login-mode h-screen overflow-hidden">
                <main className="flex-1 w-full bg-[var(--color-bg-primary)]">
                    {children}
                </main>
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
            {importModal}
        </div>
    );
}
