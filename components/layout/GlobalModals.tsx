'use client';

import { useAppStore, useLibraryStore } from '@/stores/appStore';
import { useAppStore as useAppStoreInternal } from '@/stores/appStore'; // Fix duplicate import hygiene if needed, but actually just update the existing line
import { XRayModal } from '@/components/library/XRayModal';
import { useEffect } from 'react';

export function GlobalModals() {
    const { xrayModalData, setXrayModalData } = useAppStore();
    // Debug Watcher for LibraryStore view
    const { currentView } = useLibraryStore();
    useEffect(() => {
        console.log('GlobalWatcher: currentView changed to:', currentView);
    }, [currentView]);

    console.log('GlobalModals render:', { hasData: !!xrayModalData, data: xrayModalData });

    return (
        <>
            {xrayModalData && (
                <XRayModal
                    data={xrayModalData}
                    onClose={() => {
                        console.log('GlobalModals: Closing modal');
                        setXrayModalData(null);
                    }}
                />
            )}
        </>
    );
}
