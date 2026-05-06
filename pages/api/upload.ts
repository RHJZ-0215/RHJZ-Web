import { put } from '@vercel/blob';
import type { NextApiRequest, NextApiResponse } from 'next';
import { IncomingForm } from 'formidable';
import fs from 'fs/promises';
import { addLog } from '../../utils/logger';

function getClientIp(req: NextApiRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

export const config = {
 api: {
 bodyParser: false,
 },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
 console.log('Upload API called with method:', req.method);

 if (req.method !== 'POST') {
 console.log('Method not allowed:', req.method);
 return res.status(405).json({ 
 status: 'error', 
 message: 'Method not allowed',
 details: '只支持 POST 请求' 
 });
 }

 const form = new IncomingForm({ 
 keepExtensions: true,
 maxFileSize: 100 * 1024 * 1024, // 100MB
 allowEmptyFiles: true
 });

 form.parse(req, async (err, _fields, files) => {
 if (err) {
 console.error('Form parse error:', err);
 return res.status(500).json({ 
 status: 'error', 
 message: '解析文件失败',
 details: err.message 
 });
 }

 const fileField = files.file;
 if (!fileField) {
 return res.status(400).json({ 
 status: 'error', 
 message: '没有选择文件',
 details: '请选择要上传的文件' 
 });
 }

 const fileObj = Array.isArray(fileField) ? fileField[0] : fileField;
 const filePath = (fileObj as any).filepath;
 const originalFilename = (fileObj as any).originalFilename;

 if (!filePath) {
 return res.status(500).json({ 
 status: 'error', 
 message: '无法获取文件路径',
 details: '文件对象中缺少 filepath 属性' 
 });
 }

 try {
 const buffer = await fs.readFile(filePath);
 const filename = originalFilename || `uploaded-${Date.now()}`;
 
 console.log('Uploading to Vercel Blob with name:', filename);
 const result = await put(filename, buffer, { 
 access: 'private' as const 
 });
 
 console.log('Upload successful:', result.url);
 await addLog({
 ip: getClientIp(req),
 type: 'upload',
 action: '文件上传',
 details: `文件: ${filename}, 大小: ${buffer.length} bytes`
 });
 return res.status(200).json({ 
 status: 'success', 
 message: '上传成功',
 url: result.url,
 filename: filename,
 size: buffer.length
 });
 
 } catch (error: any) {
 console.error('Upload error:', error);
 
 let errorMessage = '上传失败';
 let errorDetails = '未知错误';
 
 if (error.message) {
 errorDetails = error.message;
 if (error.message.includes('BLOB_READ_WRITE_TOKEN')) {
 errorMessage = '存储配置未完成';
 errorDetails = '请在 Vercel 控制台启用 Blob 存储';
 }
 }
 
 return res.status(500).json({ 
 status: 'error', 
 message: errorMessage,
 details: errorDetails,
 timestamp: new Date().toISOString()
 });
 }
 });
}