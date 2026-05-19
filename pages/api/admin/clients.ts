import { NextApiRequest, NextApiResponse } from 'next'
import multer from 'multer'
import { IncomingForm } from 'formidable'
import { promises as fs } from 'fs'
import { put, del, list, head } from '@vercel/blob'

interface ClientInfo {
  id: string
  ip: string
  country: string
  city: string
  isp: string
  hostname: string
  os: string
  username: string
  cpu: string
  ram: string
  lastHeartbeat: number
  status: 'online' | 'offline'
  screenshotUrl?: string
}

const clients = new Map<string, ClientInfo>()
const screenshots = new Map<string, string>()

const getGeolocation = async (ip: string): Promise<{ country: string; city: string; isp: string }> => {
  try {
    if (ip === '::1' || ip === '127.0.0.1' || ip.startsWith('192.168.')) {
      return { country: '本地', city: '局域网', isp: '本地网络' }
    }
    
    const response = await fetch(`https://ipapi.co/${ip}/json/`)
    const data = await response.json()
    
    return {
      country: data.country_name || '未知',
      city: data.city || '未知',
      isp: data.org || '未知'
    }
  } catch {
    return { country: '未知', city: '未知', isp: '未知' }
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
}

const parseForm = async (req: NextApiRequest): Promise<{ fields: any; files: any }> => {
  return new Promise((resolve, reject) => {
    const form = new IncomingForm({
      maxFileSize: 10 * 1024 * 1024,
    })
    
    form.parse(req, (err, fields, files) => {
      if (err) {
        reject(err)
        return
      }
      resolve({ fields, files })
    })
  })
}

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const action = req.query.action as string
  const clientId = req.query.id as string

  try {
    switch (action) {
      case 'register': {
        const body = await new Promise((resolve) => {
          let data = ''
          req.on('data', (chunk) => { data += chunk })
          req.on('end', () => { resolve(JSON.parse(data)) })
        }) as { id: string; hostname: string; os: string; username: string; cpu: string; ram: string }

        const ip = (req.headers['x-forwarded-for'] as string) || 
                   (req.connection.remoteAddress as string) || 
                   'unknown'
        const geo = await getGeolocation(ip)
        
        const client: ClientInfo = {
          id: body.id,
          ip,
          ...geo,
          hostname: body.hostname,
          os: body.os,
          username: body.username,
          cpu: body.cpu,
          ram: body.ram,
          lastHeartbeat: Date.now(),
          status: 'online'
        }
        
        clients.set(body.id, client)
        res.status(200).json({ status: 'success', message: '客户端注册成功' })
        break
      }

      case 'heartbeat': {
        if (!clientId) {
          res.status(400).json({ status: 'error', message: '缺少客户端ID' })
          break
        }
        
        const client = clients.get(clientId)
        if (client) {
          client.lastHeartbeat = Date.now()
          client.status = 'online'
          clients.set(clientId, client)
          res.status(200).json({ status: 'success', message: '心跳更新成功' })
        } else {
          res.status(404).json({ status: 'error', message: '客户端不存在' })
        }
        break
      }

      case 'list': {
        const now = Date.now()
        const clientList = Array.from(clients.values()).map(client => {
          const isOnline = now - client.lastHeartbeat < 30000
          return {
            ...client,
            status: isOnline ? 'online' : 'offline' as 'online' | 'offline'
          }
        })
        res.status(200).json({ status: 'success', clients: clientList })
        break
      }

      case 'info': {
        if (!clientId) {
          res.status(400).json({ status: 'error', message: '缺少客户端ID' })
          break
        }
        
        const client = clients.get(clientId)
        if (client) {
          res.status(200).json({ status: 'success', client })
        } else {
          res.status(404).json({ status: 'error', message: '客户端不存在' })
        }
        break
      }

      case 'screenshot': {
        if (!clientId) {
          res.status(400).json({ status: 'error', message: '缺少客户端ID' })
          break
        }
        
        const client = clients.get(clientId)
        if (client && client.screenshotUrl) {
          res.status(200).json({ status: 'success', url: client.screenshotUrl })
        } else {
          res.status(404).json({ status: 'error', message: '截图不存在' })
        }
        break
      }

      case 'uploadScreenshot': {
        if (!clientId) {
          res.status(400).json({ status: 'error', message: '缺少客户端ID' })
          break
        }
        
        try {
          const { files } = await parseForm(req)
          
          console.log('[uploadScreenshot] files:', JSON.stringify(files, null, 2))
          
          if (!files) {
            res.status(400).json({ status: 'error', message: '没有接收到文件' })
            break
          }
          
          if (!files.screenshot) {
            res.status(400).json({ status: 'error', message: '缺少截图文件' })
            break
          }
          
          const screenshotFile = files.screenshot
          console.log('[uploadScreenshot] screenshotFile:', screenshotFile)
          
          let filepath = ''
          if (Array.isArray(screenshotFile)) {
            filepath = screenshotFile[0].filepath
          } else {
            filepath = screenshotFile.filepath
          }
          
          console.log('[uploadScreenshot] filepath:', filepath)
          
          const fileData = await fs.readFile(filepath)
          const screenshotPath = `screenshots/${clientId}.jpg`
          
          try {
            const existingBlobs = await list({ prefix: `screenshots/${clientId}` })
            for (const blob of existingBlobs.blobs) {
              await del(blob.url)
              console.log(`[uploadScreenshot] 删除旧截图: ${blob.url}`)
            }
          } catch (delError) {
            console.log(`[uploadScreenshot] 删除旧截图失败（可能是首次上传）: ${delError}`)
          }
          
          const result = await put(screenshotPath, fileData, {
            contentType: 'image/jpeg',
            access: 'private'
          })
          
          console.log('[uploadScreenshot] Blob上传结果:', result)
          
          const client = clients.get(clientId)
          if (client) {
            client.screenshotUrl = result.url
            clients.set(clientId, client)
          }
          
          res.status(200).json({ status: 'success', message: '截图上传成功', url: result.url })
        } catch (error) {
          console.error('[uploadScreenshot] 错误:', error)
          res.status(500).json({ status: 'error', message: `服务器内部错误: ${(error as Error).message}` })
        }
        break
      }

      case 'remove': {
        if (!clientId) {
          res.status(400).json({ status: 'error', message: '缺少客户端ID' })
          break
        }
        
        clients.delete(clientId)
        screenshots.delete(clientId)
        res.status(200).json({ status: 'success', message: '客户端已移除' })
        break
      }

      default: {
        res.status(400).json({ status: 'error', message: '未知操作' })
      }
    }
  } catch (error) {
    console.error('API Error:', error)
    res.status(500).json({ status: 'error', message: '服务器内部错误' })
  }
}

export default handler
