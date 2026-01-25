
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';

export async function GET(req: NextRequest) {
    try {
        const debugInfo: any = {
            timestamp: new Date().toISOString(),
            process: {
                uid: process.getuid ? process.getuid() : 'N/A',
                gid: process.getgid ? process.getgid() : 'N/A',
                cwd: process.cwd(),
                env_LECTRO_LIBRARY_PATH: process.env.LECTRO_LIBRARY_PATH,
                env_NODE_ENV: process.env.NODE_ENV,
                userInfo: os.userInfo ? os.userInfo() : 'N/A'
            },
            paths: {},
            headers: {
                'x-library-path': req.headers.get('x-library-path')
            }
        };

        // Resolved Library Path Logic (mimicking metadata/route.ts)
        const headerPath = req.headers.get('x-library-path');
        const envPath = process.env.LECTRO_LIBRARY_PATH;

        let configPath = null;
        const serverConfigFile = path.join(process.cwd(), 'server-config.json');
        if (fs.existsSync(serverConfigFile)) {
            try {
                const conf = JSON.parse(fs.readFileSync(serverConfigFile, 'utf8'));
                configPath = conf.libraryPath;
            } catch (e) { }
        }

        const defaultPath = path.resolve(process.cwd(), 'library');

        debugInfo.paths.candidates = {
            header: headerPath,
            env: envPath,
            config: configPath,
            default: defaultPath
        };

        // Check Access for each
        const checkPath = (p: string | null | undefined) => {
            if (!p) return null;
            let status: any = { exists: false };
            try {
                status.exists = fs.existsSync(p);
                if (status.exists) {
                    const stats = fs.statSync(p);
                    status.isDirectory = stats.isDirectory();
                    status.mode = stats.mode.toString(8); // Octal
                    status.uid = stats.uid;
                    status.gid = stats.gid;

                    // Try Read
                    try {
                        fs.accessSync(p, fs.constants.R_OK);
                        status.readable = true;
                    } catch { status.readable = false; }

                    // Try Write
                    try {
                        fs.accessSync(p, fs.constants.W_OK);
                        status.writable = true;
                    } catch { status.writable = false; }

                    // List files if dir
                    if (status.isDirectory && status.readable) {
                        const files = fs.readdirSync(p);
                        status.fileCount = files.length;
                        status.hasMetadataJson = files.includes('lectro_data.json');

                        if (status.hasMetadataJson) {
                            const jsonPath = path.join(p, 'lectro_data.json');
                            const jsonStats = fs.statSync(jsonPath);
                            status.metadataFile = {
                                mode: jsonStats.mode.toString(8),
                                uid: jsonStats.uid,
                                gid: jsonStats.gid,
                                size: jsonStats.size
                            };

                            // Try Write File
                            try {
                                fs.accessSync(jsonPath, fs.constants.W_OK);
                                status.metadataFile.writable = true;
                            } catch { status.metadataFile.writable = false; }
                        }
                    }
                }
            } catch (e: any) {
                status.error = e.message;
            }
            return status;
        };

        debugInfo.paths.access = {
            headerPath: checkPath(headerPath),
            envPath: checkPath(envPath),
            defaultPath: checkPath(defaultPath),
            cwd: checkPath(process.cwd())
        };

        return NextResponse.json(debugInfo, { status: 200 });

    } catch (error: any) {
        return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 });
    }
}
