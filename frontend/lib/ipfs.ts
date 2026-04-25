export async function fetchReasoningBlob(cid: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`https://gateway.pinata.cloud/ipfs/${cid}`)
    if (!res.ok) return null
    return res.json() as Promise<Record<string, unknown>>
  } catch {
    return null
  }
}
