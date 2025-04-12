import multer from 'multer';
import path from 'path';
import fs from 'fs/promises'; 
import { Request } from 'express'; 

const MODELS_BASE_DIR = path.resolve(__dirname, '../../public/models');

const ensureBaseDirExists = async () => {
    try {
        await fs.access(MODELS_BASE_DIR);
    } catch (error) {

        console.log(`Base models directory not found. Creating: ${MODELS_BASE_DIR}`);
        await fs.mkdir(MODELS_BASE_DIR, { recursive: true });
    }
};

const storage = multer.diskStorage({

    destination: async (req: Request, file, cb) => {

        await ensureBaseDirExists();

        const modelName = req.body.modelName;

        if (!modelName || typeof modelName !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(modelName)) {

             return cb(new Error('Invalid or missing "modelName" in request body. Use alphanumeric characters, underscores, or hyphens.'), '');
        }

        const modelDir = path.join(MODELS_BASE_DIR, modelName);

        try {

            await fs.mkdir(modelDir, { recursive: true });
            cb(null, modelDir); 
        } catch (error) {
             console.error(`Failed to create directory ${modelDir}:`, error);

             const err = error instanceof Error ? error : new Error('Failed to create model directory');
             cb(err, '');
        }
    },

    filename: (req, file, cb) => {

        const safeFilename = path.basename(file.originalname);
        cb(null, safeFilename); 
    }
});

const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (file.mimetype === 'application/json' || file.mimetype === 'application/octet-stream' || file.originalname.endsWith('.json') || file.originalname.endsWith('.bin')) {
        cb(null, true); 
    } else {
        console.warn(`Rejected file upload: ${file.originalname} (Invalid type: ${file.mimetype})`);
        cb(null, false); 

    }
};

const uploadMiddleware = multer({
    storage: storage,
    fileFilter: fileFilter, 
    limits: {
        fileSize: 100 * 1024 * 1024, 

    }
 });

export default uploadMiddleware;