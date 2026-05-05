import { put } from '@vercel/blob';
import type { NextApiRequest, NextApiResponse } from 'next';
import { IncomingForm, type File } from 'formidable';

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
 maxFileSize: 100 * 1024 * 1024 // 100MB
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

 console.log('Files received:', JSON.stringify(files));

 const fileField = files.file;
 if (!fileField) {
 console.log('No file provided');
 return res.status(400).json({ 
 status: 'error', 
 message: '没有选择文件',
 details: '请选择要上传的文件' 
 });
 }

 const fileObj = Array.isArray(fileField) ? fileField[0] : fileField;
 
 const filePath = (fileObj as File).filepath;
 const originalFilename = (fileObj as File).originalFilename;
 const fileSize = (fileObj as File).size;

 console.log('File path:', filePath);
 console.log('Original filename:', originalFilename);
 console.log('File size:', fileSize);

 if (!filePath) {
 console.error('File path is undefined');
 return res.status(500).json({ 
 status: 'error', 
 message: '无法获取文件路径',
 details: '文件对象中缺少 filepath 属性' 
 });
 }

 if (!originalFilename) {
 console.warn('Original filename is undefined, using default name');
 }

 try {
 const fs = await import('fs/promises');
 console.log('Reading file from:', filePath);
 
 const buffer = await fs.readFile(filePath);
 console.log('File read successfully, size:', buffer.length);
 
 const filename = originalFilename || `uploaded-${Date.now()}`;
 
 console.log('Uploading to Vercel Blob with name:', filename);
 const result = await put(filename, buffer, {
 access: 'public',
 });
 
 console.log('Upload successful:', result.url);
 return res.status(200).json({ 
 status: 'success', 
 message: '上传成功',
 url: result.url,
 filename: filename,
 size: buffer.length
 });
 
 } catch (error: any) {
 console.error('Upload error - type:', error.constructor.name);
 console.error('Upload error - message:', error.message);
 console.error('Upload error - stack:', error.stack);
 
 let errorMessage = '上传失败';
 let errorDetails = '未知错误';
 
 if (error.message) {
 errorDetails = error.message;
 
 if (error.message.includes('BLOB_READ_WRITE_TOKEN')) {
 errorMessage = '存储配置未完成';
 errorDetails = '请在 Vercel 控制台启用 Blob 存储';
 } else if (error.message.includes('ENOENT')) {
 errorMessage = '文件不存在';
 errorDetails = '无法读取上传的临时文件';
 } else if (error.message.includes('EACCES')) {
 errorMessage = '权限不足';
 errorDetails = '无法读取文件，请检查权限';
 } else if (error.message.includes('size')) {
 errorMessage = '文件过大';
 errorDetails = '超过最大允许的文件大小 (100MB)';
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