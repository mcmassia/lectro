'use client';

import { useAppStore } from '@/stores/appStore';
import { XRayModal } from '@/components/library/XRayModal';

export function GlobalModals() {
    const { xrayModalData, setXrayModalData } = useAppStore();

    return (
        <>
            {xrayModalData && (
                <XRayModal
                    data={xrayModalData}
                    onClose={() => setXrayModalData(null)}
                />
            )}
        </>
    );
}
