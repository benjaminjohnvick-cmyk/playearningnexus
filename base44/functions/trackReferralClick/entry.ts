import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { link_code } = await req.json();

    if (!link_code) {
      return Response.json({ error: 'link_code required' }, { status: 400 });
    }

    const links = await base44.asServiceRole.entities.CustomReferralLink.filter({ link_code });
    if (!links.length) {
      return Response.json({ error: 'Link not found' }, { status: 404 });
    }

    const link = links[0];
    await base44.asServiceRole.entities.CustomReferralLink.update(link.id, {
      clicks: (link.clicks || 0) + 1,
    });

    return Response.json({ success: true, clicks: (link.clicks || 0) + 1 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});