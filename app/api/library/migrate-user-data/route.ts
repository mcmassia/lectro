import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getLibraryPath } from '@/lib/server/config';

/**
 * POST /api/library/migrate-user-data
 * 
 * Migrates all userBookData and annotations to the correct mcmassia userId.
 * This fixes legacy data that was created with a different/random userId.
 */
export async function POST(req: NextRequest) {
    try {
        const libraryPath = getLibraryPath();
        const dbPath = path.join(libraryPath, 'lectro_data.json');

        if (!fs.existsSync(dbPath)) {
            return NextResponse.json({ error: 'lectro_data.json not found' }, { status: 404 });
        }

        const fileContent = fs.readFileSync(dbPath, 'utf8');
        const data = JSON.parse(fileContent);

        // Find the mcmassia user
        const mcmassiaUser = data.users?.find((u: any) => u.username === 'mcmassia');
        if (!mcmassiaUser) {
            return NextResponse.json({ error: 'mcmassia user not found' }, { status: 404 });
        }

        const correctUserId = mcmassiaUser.id;
        console.log(`[Migration] Correct mcmassia userId: ${correctUserId}`);

        let migratedAnnotations = 0;
        let migratedUserBookData = 0;

        // Fix annotations - assign correct userId to all annotations without one or with wrong one
        if (data.annotations && Array.isArray(data.annotations)) {
            for (const annotation of data.annotations) {
                if (!annotation.userId || annotation.userId !== correctUserId) {
                    console.log(`[Migration] Fixing annotation ${annotation.id}: ${annotation.userId || 'null'} -> ${correctUserId}`);
                    annotation.userId = correctUserId;
                    annotation.updatedAt = new Date().toISOString();
                    migratedAnnotations++;
                }
            }
        }

        // Fix userBookData - migrate all entries to the correct userId
        if (data.userBookData && Array.isArray(data.userBookData)) {
            // First, remove entries with wrong userId and collect their data
            const wrongUserData = data.userBookData.filter((d: any) => d.userId !== correctUserId);
            const correctUserData = data.userBookData.filter((d: any) => d.userId === correctUserId);

            // Create a map of correct user's book data by bookId for merging
            const correctDataMap: Map<string, any> = new Map(correctUserData.map((d: any) => [d.bookId, d]));

            // Migrate wrong user data to correct user
            for (const wrongData of wrongUserData) {
                const existingCorrect: any = correctDataMap.get(wrongData.bookId);

                if (existingCorrect) {
                    // Merge - keep the one with more progress or more recent activity
                    const wrongTime = new Date(wrongData.updatedAt || wrongData.lastReadAt || 0).getTime();
                    const correctTime = new Date(existingCorrect.updatedAt || existingCorrect.lastReadAt || 0).getTime();

                    if (wrongTime > correctTime || wrongData.progress > (existingCorrect.progress || 0)) {
                        // Wrong data is newer or has more progress - update the correct entry
                        Object.assign(existingCorrect, {
                            ...wrongData,
                            userId: correctUserId,
                            updatedAt: new Date().toISOString()
                        });
                        console.log(`[Migration] Merged userBookData for book ${wrongData.bookId}`);
                        migratedUserBookData++;
                    }
                } else {
                    // No existing correct data - create new entry with correct userId
                    correctDataMap.set(wrongData.bookId, {
                        ...wrongData,
                        userId: correctUserId,
                        updatedAt: new Date().toISOString()
                    });
                    console.log(`[Migration] Migrated userBookData for book ${wrongData.bookId}: ${wrongData.userId} -> ${correctUserId}`);
                    migratedUserBookData++;
                }
            }

            // Replace userBookData with only correct user's data
            data.userBookData = Array.from(correctDataMap.values());
        }

        // Save back
        data.lastSync = new Date().toISOString();
        fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));

        console.log(`[Migration] Complete: ${migratedAnnotations} annotations, ${migratedUserBookData} userBookData records`);

        return NextResponse.json({
            success: true,
            correctUserId,
            migratedAnnotations,
            migratedUserBookData,
            message: `Migrated ${migratedAnnotations} annotations and ${migratedUserBookData} userBookData records to userId ${correctUserId}`
        });

    } catch (error) {
        console.error('Migration error:', error);
        return NextResponse.json({
            error: 'Migration failed',
            details: (error as Error).message
        }, { status: 500 });
    }
}
