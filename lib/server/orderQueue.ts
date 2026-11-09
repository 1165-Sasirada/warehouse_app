import { Client, Receiver } from '@upstash/qstash'
import { Redis } from '@upstash/redis'
import { randomUUID } from 'node:crypto'
import { createSupabaseAdminClient } from '@/lib/server/supabaseAdmin'

const QUEUE_TTL_SECONDS = 30 * 24 * 60 * 60
const QUEUE_PREFIX = 'warehouse:orders'

export interface QueuedOrderItem {
  sku_id: string
  location_id: string
  quantity: number
  pick_sequence: number
}

export interface QueuedOrder {
  id: string
  batchId: string
  orderNumber: string
  customerId: string
  items: QueuedOrderItem[]
  status: 'queued' | 'processing' | 'completed' | 'failed'
  error?: string
  createdAt: string
}

export interface QueueBatchResult {
  batchId: string
  total: number
  queued: number
  failed: number
}

export interface QueueBatchStatus {
  batchId: string
  total: number
  completed: number
  failed: number
  queued: number
  status: 'queued' | 'processing' | 'completed' | 'completed_with_errors'
}

function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) {
    throw new Error('Upstash Redis REST URL and token are not configured.')
  }
  return new Redis({ url, token })
}

function getQStash() {
  const token = process.env.QSTASH_TOKEN
  if (!token) {
    throw new Error('QSTASH_TOKEN is not configured.')
  }
  return new Client({ token })
}

function getWorkerUrl() {
  const url = process.env.ORDER_QUEUE_WORKER_URL
  if (!url) {
    throw new Error('ORDER_QUEUE_WORKER_URL must point to the deployed queue worker endpoint.')
  }

  const parsedUrl = new URL(url)
  if (parsedUrl.protocol !== 'https:') {
    throw new Error('ORDER_QUEUE_WORKER_URL must use HTTPS.')
  }
  return parsedUrl.toString()
}

function batchKey(batchId: string) {
  return `${QUEUE_PREFIX}:batch:${batchId}`
}

function jobsKey(batchId: string) {
  return `${QUEUE_PREFIX}:pending:${batchId}`
}

function jobKey(jobId: string) {
  return `${QUEUE_PREFIX}:job:${jobId}`
}

async function writeFailedJob(redis: Redis, job: QueuedOrder, message: string) {
  await redis.multi()
    .set(
      jobKey(job.id),
      { ...job, status: 'failed', error: message },
      { ex: QUEUE_TTL_SECONDS }
    )
    .hincrby(batchKey(job.batchId), 'failed', 1)
    .lrem(jobsKey(job.batchId), 0, job.id)
    .exec()
}

export async function enqueueOrders(
  customerId: string,
  orders: Array<{ orderNumber: string; items: QueuedOrderItem[] }>
): Promise<QueueBatchResult> {
  if (orders.length === 0) {
    throw new Error('At least one order is required.')
  }

  const redis = getRedis()
  const qstash = getQStash()
  const workerUrl = getWorkerUrl()
  const batchId = randomUUID()
  const createdAt = new Date().toISOString()
  const batch = batchKey(batchId)
  let queued = 0
  let failed = 0

  await redis.hset(batch, {
    ownerId: customerId,
    total: orders.length,
    completed: 0,
    failed: 0,
    createdAt,
  })
  await redis.expire(batch, QUEUE_TTL_SECONDS)

  const jobs: QueuedOrder[] = orders.map((order) => ({
    id: randomUUID(),
    batchId,
    orderNumber: order.orderNumber,
    customerId,
    items: order.items,
    status: 'queued',
    createdAt,
  }))
  const pipeline = redis.pipeline()
  for (const job of jobs) {
    pipeline.set(jobKey(job.id), job, { ex: QUEUE_TTL_SECONDS })
    pipeline.rpush(jobsKey(batchId), job.id)
  }
  pipeline.expire(jobsKey(batchId), QUEUE_TTL_SECONDS)
  await pipeline.exec()

  const qstashResults: Array<{ job: QueuedOrder; queued: boolean }> = []
  for (let offset = 0; offset < jobs.length; offset += 10) {
    const chunk = jobs.slice(offset, offset + 10)
    const results = await Promise.all(chunk.map(async (job) => {
      try {
        await qstash.publishJSON({
          url: workerUrl,
          body: { jobId: job.id },
          retries: 3,
        })
        return { job, queued: true }
      } catch (error) {
        console.error(`Unable to dispatch queued order ${job.orderNumber}:`, error)
        const message = 'Could not schedule this order for processing. Please retry this order.'
        await writeFailedJob(redis, job, message)
        return { job, queued: false }
      }
    }))
    qstashResults.push(...results)
  }

  for (const result of qstashResults) {
    if (result.queued) queued += 1
    else failed += 1
  }

  return { batchId, total: orders.length, queued, failed }
}

export async function getQueueBatchStatus(batchId: string): Promise<QueueBatchStatus | null> {
  const redis = getRedis()
  const batch = await redis.hgetall<Record<string, string | number>>(batchKey(batchId))
  if (!batch || Object.keys(batch).length === 0) return null

  const total = Number(batch.total ?? 0)
  const completed = Number(batch.completed ?? 0)
  const failed = Number(batch.failed ?? 0)
  const queued = Math.max(0, total - completed - failed)

  return {
    batchId,
    total,
    completed,
    failed,
    queued,
    status: queued > 0
      ? (completed + failed > 0 ? 'processing' : 'queued')
      : failed > 0
        ? 'completed_with_errors'
        : 'completed',
  }
}

export async function processQueuedOrder(jobId: string, retryCount: number) {
  const redis = getRedis()
  const key = jobKey(jobId)
  const job = await redis.get<QueuedOrder>(key)
  if (!job) {
    throw new Error('Queued order was not found or has expired.')
  }
  if (job.status === 'completed' || job.status === 'failed') {
    return { status: job.status }
  }

  const lockKey = `${QUEUE_PREFIX}:lock:${jobId}`
  const lock = await redis.set(lockKey, '1', { nx: true, ex: 60 })
  if (!lock) {
    throw new Error('This order is already being processed.')
  }

  try {
    let orderError: string | null = null
    try {
      const supabase = createSupabaseAdminClient()
      const { error } = await supabase.rpc('create_queued_order', {
        p_order_number: job.orderNumber,
        p_customer_id: job.customerId,
        p_items: job.items,
      })
      if (error) orderError = error.message
    } catch (error) {
      orderError = error instanceof Error ? error.message : 'Order processing failed.'
    }

    if (orderError) {
      if (retryCount >= 3) {
        await writeFailedJob(redis, job, orderError)
        return { status: 'failed' as const }
      }
      throw new Error(orderError)
    }

    await redis.multi()
      .set(key, { ...job, status: 'completed' }, { ex: QUEUE_TTL_SECONDS })
      .hincrby(batchKey(job.batchId), 'completed', 1)
      .lrem(jobsKey(job.batchId), 0, jobId)
      .exec()
    return { status: 'completed' as const }
  } finally {
    await redis.del(lockKey)
  }
}

export function createQStashReceiver() {
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY
  if (!currentSigningKey || !nextSigningKey) {
    throw new Error('QStash current and next signing keys are not configured.')
  }
  return new Receiver({ currentSigningKey, nextSigningKey })
}

export async function isBatchOwner(batchId: string, userId: string) {
  const redis = getRedis()
  const ownerId = await redis.hget<string>(batchKey(batchId), 'ownerId')
  return ownerId === userId
}
