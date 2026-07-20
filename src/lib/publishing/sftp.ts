import { Client } from 'ssh2'
import { Readable } from 'stream'
import type { PostPayload, PublishResult } from './types'

export interface SFTPCredentials {
  host: string
  port?: string | number
  username: string
  password?: string
  private_key?: string
  upload_path: string
  file_format?: 'html' | 'markdown'
}

function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80)
}

function buildHtml(post: PostPayload): string {
  return [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '  <meta charset="UTF-8">',
    `  <title>${post.meta_title ?? post.title}</title>`,
    post.meta_description ? `  <meta name="description" content="${post.meta_description}">` : '',
    '</head>',
    '<body>',
    `  <h1>${post.title}</h1>`,
    `  ${post.content}`,
    '</body>',
    '</html>',
  ].filter(Boolean).join('\n')
}

function sftpUpload(
  credentials: SFTPCredentials,
  remotePath: string,
  fileContent: string,
): Promise<PublishResult> {
  return new Promise((resolve) => {
    const conn = new Client()

    const timer = setTimeout(() => {
      conn.end()
      resolve({ integration: 'sftp', success: false, error: 'Connection timed out (15s)' })
    }, 15_000)

    conn.on('error', (err) => {
      clearTimeout(timer)
      resolve({ integration: 'sftp', success: false, error: err.message })
    })

    conn.on('ready', () => {
      conn.sftp((sftpErr, sftp) => {
        if (sftpErr) {
          clearTimeout(timer)
          conn.end()
          resolve({ integration: 'sftp', success: false, error: sftpErr.message })
          return
        }

        const writeStream = sftp.createWriteStream(remotePath)

        writeStream.on('close', () => {
          clearTimeout(timer)
          conn.end()
          resolve({ integration: 'sftp', success: true, url: `sftp://${credentials.host}${remotePath}` })
        })

        writeStream.on('error', (writeErr: Error) => {
          clearTimeout(timer)
          conn.end()
          resolve({ integration: 'sftp', success: false, error: writeErr.message })
        })

        Readable.from([fileContent]).pipe(writeStream)
      })
    })

    conn.connect({
      host: credentials.host,
      port: Number(credentials.port ?? 22),
      username: credentials.username,
      ...(credentials.password   ? { password: credentials.password }                   : {}),
      ...(credentials.private_key ? { privateKey: credentials.private_key }              : {}),
    })
  })
}

export async function publishToSFTP(
  credentials: SFTPCredentials,
  post: PostPayload,
): Promise<PublishResult> {
  const { upload_path, file_format = 'html' } = credentials
  const date = new Date().toISOString().split('T')[0]
  const slug = post.slug || slugify(post.title)
  const ext = file_format === 'html' ? 'html' : 'md'
  const filename = `${date}-${slug}.${ext}`
  const remotePath = `${upload_path.replace(/\/$/, '')}/${filename}`
  const content = file_format === 'html' ? buildHtml(post) : post.content

  return sftpUpload(credentials, remotePath, content)
}

export async function testSFTPConnection(credentials: SFTPCredentials): Promise<{ ok: boolean; msg: string }> {
  return new Promise((resolve) => {
    const conn = new Client()

    const timer = setTimeout(() => {
      conn.end()
      resolve({ ok: false, msg: 'Connection timed out (10s)' })
    }, 10_000)

    conn.on('error', (err) => {
      clearTimeout(timer)
      resolve({ ok: false, msg: err.message })
    })

    conn.on('ready', () => {
      clearTimeout(timer)
      conn.sftp((sftpErr, sftp) => {
        if (sftpErr) {
          conn.end()
          resolve({ ok: false, msg: sftpErr.message })
          return
        }
        sftp.stat(credentials.upload_path, (statErr) => {
          conn.end()
          if (statErr) {
            resolve({ ok: false, msg: `Upload path not found: ${credentials.upload_path}` })
          } else {
            resolve({ ok: true, msg: `Connected to ${credentials.host} — path exists` })
          }
        })
      })
    })

    conn.connect({
      host: credentials.host,
      port: Number(credentials.port ?? 22),
      username: credentials.username,
      ...(credentials.password    ? { password: credentials.password }    : {}),
      ...(credentials.private_key ? { privateKey: credentials.private_key } : {}),
    })
  })
}
