import type { NextApiRequest, NextApiResponse } from 'next'
import { put } from '@vercel/blob'
import { IncomingForm, Fields, Files } from 'formidable'
import fs from 'fs'
import path from 'path'

export const config = {
  api: {
    bodyParser: false,
  },
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', message: 'Method not allowed' })
  }

  const form = new IncomingForm({
    keepExtensions: true,
    maxFileSize: 50 * 1024 * 1024,
  })

  try {
    const [fields, files] = await new Promise<[Fields<string>, Files<string>]>((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) {
          reject(err)
        } else {
          resolve([fields, files])
        }
      })
    })

    const file = files.file
    if (!file) {
      return res.status(400).json({ status: 'error', message: '未选择文件' })
    }

    const fileObj = Array.isArray(file) ? file[0] : file
    const filename = fileObj.originalFilename || fileObj.newFilename
    const filePath = fileObj.filepath

    if (!filePath) {
      return res.status(400).json({ status: 'error', message: '文件路径无效' })
    }

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.error('BLOB_READ_WRITE_TOKEN environment variable is not set')
      
      const backupDir = path.join('/tmp', 'uploads')
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true })
      }
      
      const destPath = path.join(backupDir, filename)
      fs.copyFileSync(filePath, destPath)
      
      return res.status(200).json({
        status: 'success',
        message: `文件 "${filename}" 上传成功（使用临时存储）`,
        note: 'Vercel Blob 未配置，文件存储在临时目录，重启后会丢失'
      })
    }

    const { url } = await put(filename, filePath, {
      access: 'public',
    })

    console.log('File uploaded to Vercel Blob:', url)
    return res.status(200).json({
      status: 'success',
      message: `文件 "${filename}" 上传成功`,
      url: url
    })
  } catch (err: any) {
    console.error('Upload error:', err.message)
    console.error('Error stack:', err.stack)
    
    return res.status(500).json({ 
      status: 'error', 
      message: '文件上传失败',
      error: err.message || 'Unknown error',
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    })
  }
}