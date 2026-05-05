import type { NextApiRequest, NextApiResponse } from 'next'
import fs from 'fs'
import path from 'path'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ status: 'error', message: 'Method not allowed' })
  }

  const uploadDir = path.join(process.cwd(), 'public', 'uploads')
  
  try {
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }

    const files = fs.readdirSync(uploadDir).filter(file => {
      const filePath = path.join(uploadDir, file)
      return fs.statSync(filePath).isFile()
    }).map(file => {
      const filePath = path.join(uploadDir, file)
      const stat = fs.statSync(filePath)
      return {
        name: file,
        size: stat.size,
        size_str: stat.size < 1024 ? `${stat.size} B` : stat.size < 1024 * 1024 ? `${(stat.size / 1024).toFixed(2)} KB` : `${(stat.size / (1024 * 1024)).toFixed(2)} MB`,
        mtime: new Date(stat.mtime).toLocaleString('zh-CN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        })
      }
    })

    res.status(200).json({ files })
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to read files' })
  }
}