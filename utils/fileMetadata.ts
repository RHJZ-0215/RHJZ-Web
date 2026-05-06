import fs from 'fs/promises';
import path from 'path';

export interface FileMetadata {
  filename: string;
  hidden: boolean;
  uploadedAt: string;
  uploadedBy?: string;
}

const METADATA_FILE = path.join(process.cwd(), 'data', 'fileMetadata.json');

export async function initMetadata() {
  try {
    await fs.mkdir(path.dirname(METADATA_FILE), { recursive: true });
    try {
      await fs.access(METADATA_FILE);
    } catch {
      await fs.writeFile(METADATA_FILE, JSON.stringify({}));
    }
  } catch (error) {
    console.error('Failed to initialize file metadata:', error);
  }
}

export async function getMetadata(filename: string): Promise<FileMetadata | null> {
  try {
    const data = await fs.readFile(METADATA_FILE, 'utf-8');
    const metadata = JSON.parse(data);
    return metadata[filename] || null;
  } catch {
    return null;
  }
}

export async function setMetadata(filename: string, metadata: Partial<FileMetadata>): Promise<void> {
  try {
    // 确保目录存在
    await fs.mkdir(path.dirname(METADATA_FILE), { recursive: true });
    
    let allMetadata: Record<string, FileMetadata> = {};
    try {
      const data = await fs.readFile(METADATA_FILE, 'utf-8');
      allMetadata = JSON.parse(data);
    } catch {
      // 文件不存在，使用空对象
    }
    
    const existing = allMetadata[filename] || {
      filename,
      hidden: false,
      uploadedAt: new Date().toISOString()
    };
    
    allMetadata[filename] = { ...existing, ...metadata };
    await fs.writeFile(METADATA_FILE, JSON.stringify(allMetadata, null, 2));
  } catch (error) {
    console.error('Failed to set file metadata:', error);
    throw error;
  }
}

export async function toggleHidden(filename: string): Promise<boolean> {
  const existing = await getMetadata(filename);
  const newHidden = !existing?.hidden;
  await setMetadata(filename, { hidden: newHidden });
  return newHidden;
}

export async function getAllMetadata(): Promise<Record<string, FileMetadata>> {
  try {
    // 确保目录存在
    await fs.mkdir(path.dirname(METADATA_FILE), { recursive: true });
    const data = await fs.readFile(METADATA_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}