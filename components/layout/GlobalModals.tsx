'use client';

import { useAppStore } from '@/stores/appStore';
import { XRayModal } from '@/components/library/XRayModal';

export function GlobalModals() {
    const { xrayModalData, setXrayModalData } = useAppStore();

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
