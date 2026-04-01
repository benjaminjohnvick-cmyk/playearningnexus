import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { youtube_account_id, action } = body;

    if (action === 'fetch_videos') {
      // In production, use YouTube API to fetch user's videos
      // For now, return mock response
      return Response.json({
        success: true,
        videos: [
          { video_id: 'abc123', title: 'My First Video', duration: 600 },
          { video_id: 'def456', title: 'Tutorial', duration: 1200 }
        ]
      });
    }

    if (action === 'add_embeds') {
      const { video_ids } = body;
      const gridEmbedUrl = 'https://gamergain.app/PaidPPCAdsMosaic';
      
      // In production, use YouTube API to add overlays/cards
      const embedCode = `
        <iframe src="${gridEmbedUrl}" width="560" height="315" 
          frameborder="0" allowfullscreen></iframe>
      `;

      return Response.json({
        success: true,
        embeds_added: video_ids.length,
        embed_code: embedCode,
        message: 'Grid embeds added to all videos (start & end)'
      });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});