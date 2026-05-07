import { get, put, del } from '@vercel/blob';

export interface FileMetadata {
  filename: string;
  hidden: boolean;
  uploadedAt: string;
  uploadedBy?: string;
}

const METADATA_KEY = 'fileMetadata.json';

export async function getMetadata(filename: string): Promise<FileMetadata | null> {
  try {
    const result = await get(METADATA_KEY, { access: 'private' as const });
    if (!result || !result.stream) return null;
    
    const content = await result.stream.getReader().read();
    if (!content || content.done) return null;
    
    const data = new TextDecoder().decode(content.value);
    const metadata = JSON.parse(data);
    return metadata[filename] || null;
  } catch (error) {
    console.error('getMetadata error:', error);
    return null;
  }
}

export async function setMetadata(filename: string, metadata: Partial<FileMetadata>): Promise<void> {
  try {
    let allMetadata: Record<string, FileMetadata> = {};
    
    try {
      const result = await get(METADATA_KEY, { access: 'private' as const });
      if (result && result.stream) {
        const content = await result.stream.getReader().read();
        if (content && !content.done) {
          const data = new TextDecoder().decode(content.value);
          allMetadata = JSON.parse(data);
        }
      }
    } catch (error) {
      console.log('Metadata file not found, creating new:', error);
    }
    
    const existing = allMetadata[filename] || {
      filename,
      hidden: false,
      uploadedAt: new Date().toISOString()
    };
    
    allMetadata[filename] = { ...existing, ...metadata };
    const jsonContent = JSON.stringify(allMetadata, null, 2);
    
    await put(METADATA_KEY, jsonContent, { 
      access: 'private' as const,
      contentType: 'application/json',
      allowOverwrite: true
    });
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
    const result = await get(METADATA_KEY, { access: 'private' as const });
    if (!result || !result.stream) {
      console.log('No metadata file found or no stream available');
      return {};
    }
    
    const content = await result.stream.getReader().read();
    if (!content || content.done) {
      console.log('Empty metadata stream');
      return {};
    }
    
    const data = new TextDecoder().decode(content.value);
    const metadata = JSON.parse(data);
    console.log('Loaded metadata:', JSON.stringify(metadata));
    return metadata;
  } catch (error) {
    console.error('getAllMetadata error:', error);
    return {};
  }
}