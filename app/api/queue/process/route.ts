import { NextResponse } from 'next/server'
import { createQStashReceiver, processQueuedOrder } from '@/lib/server/orderQueue'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  let rawBody: string
  try {
    rawBody = await request.text()
    const signature = request.headers.get('upstash-signature')
    if (!signature) return NextResponse.json({ error: 'Missing QStash signature.' }, { status: 401 })

    const valid = await createQStashReceiver().verify({
      body: rawBody,
      signature,
      url: request.url,
    })
    if (!valid) return NextResponse.json({ error: 'Invalid QStash signature.' }, { status: 401 })
  } catch (error) {
    console.error('QStash signature verification failed:', error)
    return NextResponse.json({ error: 'Unable to verify queue request.' }, { status: 401 })
  }

  let payload: { jobId?: unknown }
  try {
    payload = JSON.parse(rawBody) as { jobId?: unknown }
  } catch {
    return NextResponse.json({ error: 'Invalid queue message.' }, { status: 400 })
  }
  if (typeof payload.jobId !== 'string' || !/^[0-9a-f-]{36}$/i.test(payload.jobId)) {
    return NextResponse.json({ error: 'Invalid queue job ID.' }, { status: 400 })
  }

  const retryHeader = request.headers.get('upstash-retried') ?? '0'
  const retryCount = /^\d+$/.test(retryHeader) ? Number(retryHeader) : 0
  try {
    const result = await processQueuedOrder(payload.jobId, retryCount)
    return NextResponse.json(result)
  } catch (error) {
    console.error(`Queue worker failed for job ${payload.jobId}:`, error)
    return NextResponse.json({ error: 'Queued order processing failed.' }, { status: 500 })
  }
}
