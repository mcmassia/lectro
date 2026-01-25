
import path from 'path';
import fs from 'fs';

const CONFIG_FILE = path.join(process.cwd(), 'server-config.json');

export function getLibraryPath(): string {
    let candidatePath = '';

    // 1. Env Var (Highest Priority for Server Admin)
    if (process.env.LECTRO_LIBRARY_PATH) {
        candidatePath = process.env.LECTRO_LIBRARY_PATH;
    }
    // 2. Config File (If exists)
    else if (fs.existsSync(CONFIG_FILE)) {
        try {
            const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
            if (config.libraryPath) {
                candidatePath = config.libraryPath;
            }
        } catch (e) {
            console.error('Error reading server-config.json:', e);
        }
    }

    // 3. Fallback to default in CWD
    if (!candidatePath) {
        candidatePath = path.join(process.cwd(), 'library');
    }

    // Validation & Safe Creation
    // If the path points to system root or suspicious locations without being explicitly Env-defined, we might want to warn.
    // For now, we trust Env/Config but verify existance/writability.

    // Attempt to ensure it exists
    if (!fs.existsSync(candidatePath)) {
        try {
            console.log(`Creating library directory at: ${candidatePath}`);
            fs.mkdirSync(candidatePath, { recursive: true });
        } catch (e) {
            console.error(`Failed to create library path at ${candidatePath}. Falling back to CWD default.`);
            // Fallback if configured path fails (e.g. permission error on /library)
            candidatePath = path.join(process.cwd(), 'library');
            if (!fs.existsSync(candidatePath)) {
                try {
                    fs.mkdirSync(candidatePath, { recursive: true });
                } catch (e2) {
                    console.error('Critical: Failed to create default library path', e2);
                }
            }
        }
    }

    return candidatePath;
}

// NOTE: We expressly REMOVE the feature where client headers can update server-config.json
// This was the cause of the production breakage.
