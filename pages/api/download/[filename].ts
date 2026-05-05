import type { NextApiRequest, NextApiResponse } from 'next'
import fs from 'fs'
import path from 'path'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ status: 'error', message: 'Method not allowed' })
  }

  const { filename } = req.query
  const decodedFilename = decodeURIComponent(filename as string)
  
  const uploadDir = path.join(process.cwd(), 'public', 'uploads')
  const filePath = path.join(uploadDir, decodedFilename)

  try {
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ status: 'error', message: '文件不存在' })
    }

    const fileContent = fs.readFileSync(filePath)
    
    res.setHeader('Content-Type', 'application/octet-stream')
    res.setHeader('Content-Disposition', `attachment; filename="${decodedFilename}"`)
    res.status(200).send(fileContent)
  } catch (error) {
    res.status(500).json({ status: 'error', message: '下载失败' })
  }
}