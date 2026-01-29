'use client';

import { ReactNode, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { LeftSidebar } from './LeftSidebar';
import { RightSidebar } from './RightSidebar';
import { ImportModal } from '@/components/library/ImportModal';
import { useAppStore } from '@/stores/appStore';
import { getUser, ensureDefaultUser, recoverLegacyData } from '@/lib/db';

interface LayoutWrapperProps {
    children: ReactNode;
}

export function LayoutWrapper({ children }: LayoutWrapperProps) {
    const pathname = usePathname();
    const isReaderMode = pathname?.startsWith('/reader');
    const isNotesMode = pathname?.startsWith('/notes');
    const { showImportModal, setShowImportModal, currentUser, login } = useAppStore();

    // Session Validation: ensure persisted user matches DB (handles ID migrations)
    const isValidating = useRef(false);
    const hasValidated = useRef(false);

    useEffect(() => {
        // Run this check once per session load to avoid blocking UI
        async function validateSession() {
            if (hasValidated.current || isValidating.current) return;
            isValidating.current = true;

            try {
                // Ensure default user state in DB is correct (migrates if needed)
                await ensureDefaultUser();

                // Recover any legacy data - ONLY if not checked recently
                // This is a heavy operation (scan all books), so we skip it if already done
                const lastRecovery = localStorage.getItem('lectro_recovery_timestamp');
                const now = Date.now();
                // Run recovery at most once every 24 hours or if never run
                if (!lastRecovery || (now - parseInt(lastRecovery)) > 24 * 60 * 60 * 1000) {
                    console.log('Running scheduled data recovery check...');
                    await recoverLegacyData();
                    localStorage.setItem('lectro_recovery_timestamp', now.toString());
                }

                // If we are logged in as 'mcmassia', check if our session ID matches the DB one
                if (currentUser && currentUser.username === 'mcmassia') {
                    const dbUser = await getUser(currentUser.username);
                    if (dbUser && dbUser.id !== currentUser.id) {
                        console.log('Session mismatch detected (Migration). Updating session...');
                        login(dbUser);
                    }
                }
                hasValidated.current = true;
            } catch (e) {
                console.error('Session validation failed', e);
            } finally {
                isValidating.current = false;
            }
        }

        // Short delay to allow UI to paint first
        const timer = setTimeout(() => {
            validateSession();
        }, 100);

        return () => clearTimeout(timer);
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
