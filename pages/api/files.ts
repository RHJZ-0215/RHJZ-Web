import type { NextApiRequest, NextApiResponse } from 'next'
import { list } from '@vercel/blob'
import fs from 'fs'
import path from 'path'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ status: 'error', message: 'Method not allowed' })
  }

  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      const backupDir = path.join('/tmp', 'uploads')
      
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true })
        return res.status(200).json({ files: [], note: 'Vercel Blob 未配置，使用临时存储' })
      }

      const files = fs.readdirSync(backupDir).filter(file => {
        if (file === '.gitkeep') return false
        const filePath = path.join(backupDir, file)
        return fs.statSync(filePath).isFile()
      }).map(file => {
        const filePath = path.join(backupDir, file)
        const stat = fs.statSync(filePath)
        const size = stat.size
        const size_str = size < 1024 ? `${size} B` : size < 1024 * 1024 ? `${(size / 1024).toFixed(2)} KB` : `${(size / (1024 * 1024)).toFixed(2)} MB`
        
        return {
          name: file,
          size: size,
          size_str: size_str,
          mtime: new Date(stat.mtime).toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
          })
        }
      })

      return res.status(200).json({ files, note: 'Vercel Blob 未配置，使用临时存储' })
    }

    const { blobs } = await list()
    
    const files = blobs.map(blob => {
      const size = blob.size || 0
      const size_str = size < 1024 ? `${size} B` : size < 1024 * 1024 ? `${(size / 1024).toFixed(2)} KB` : `${(size / (1024 * 1024)).toFixed(2)} MB`
      
      return {
        name: blob.pathname,
        size: size,
        size_str: size_str,
        mtime: blob.uploadedAt ? new Date(blob.uploadedAt).toLocaleString('zh-CN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        }) : '',
        url: blob.url
      }
    })

    res.status(200).json({ files })
  } catch (error: any) {
    console.error('Failed to list files:', error.message)
    res.status(500).json({ status: 'error', message: '获取文件列表失败', error: error.message })
  }
}