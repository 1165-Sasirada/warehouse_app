import { NextResponse } from 'next/server'
import { authenticateRequest, RequestAuthError } from '@/lib/server/requestAuth'
import { getQueueBatchStatus, isBatchOwner } from '@/lib/server/orderQueue'

export const runtime = 'nodejs'

interface RouteContext {
  params: Promise<{ batchId: string }>
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { user } = await authenticateRequest(request)
    const { batchId } = await context.params
    if (!/^[0-9a-f-]{36}$/i.test(batchId)) {
      return NextResponse.json({ error: 'Invalid batch ID.' }, { status: 400 })
    }

    if (!await isBatchOwner(batchId, user.id)) {
      return NextResponse.json({ error: 'Batch not found.' }, { status: 404 })
    }

    const status = await getQueueBatchStatus(batchId)
    if (!status) return NextResponse.json({ error: 'Batch not found.' }, { status: 404 })
    return NextResponse.json(status)
  } catch (error) {
    if (error instanceof RequestAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Unable to read order batch status:', error)
    return NextResponse.json({ error: 'Unable to load order batch status.' }, { status: 500 })
  }
}
