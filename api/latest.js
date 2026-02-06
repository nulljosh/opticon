import { list } from '@vercel/blob';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    // Find the blob by prefix
    const { blobs } = await list({ prefix: 'bread-cache/results.json' });

    if (!blobs || blobs.length === 0) {
      return res.status(200).json({ cached: false, data: null });
    }

    // Fetch the blob content
    const blobUrl = blobs[0].url;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(blobUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Blob fetch returned ${response.status}`);
    }

    const data = await response.json();

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.status(200).json({ cached: true, data });
  } catch (err) {
    console.error('Latest API error:', err);
    res.status(200).json({ cached: false, data: null, error: err.message });
  }
}
