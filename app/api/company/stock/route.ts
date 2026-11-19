import { NextRequest, NextResponse } from 'next/server';
import { authenticate, getMemberships } from '@/lib/auth';
import { createAdminSupabase } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const ctx = await authenticate(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const memberships = await getMemberships(ctx);
    const companyId = memberships[0]?.company_id;
    if (!companyId && !ctx.isPlatformAdmin) {
      return NextResponse.json({ error: 'No company associated with this account' }, { status: 403 });
    }

    const licenseId = req.nextUrl.searchParams.get('license_id');

    const admin = createAdminSupabase();

    let prodQuery = admin.from('stock_products').select('*').order('name');
    if (!ctx.isPlatformAdmin && companyId) {
      prodQuery = prodQuery.eq('company_id', companyId);
    }
    if (licenseId && licenseId !== 'all') {
      try {
        prodQuery = prodQuery.eq('license_id', licenseId);
      } catch {
        // column may not exist
      }
    }

    let { data: products, error: prodErr } = await prodQuery;
    if (prodErr && prodErr.message?.includes('license_id')) {
      let fallback = admin.from('stock_products').select('*').order('name');
      if (!ctx.isPlatformAdmin && companyId) fallback = fallback.eq('company_id', companyId);
      const retry = await fallback;
      if (retry.error) return NextResponse.json({ error: retry.error.message }, { status: 500 });
      products = (retry.data || []).filter((p: any) => {
        if (p.license_id) return p.license_id === licenseId;
        if (p.code?.includes(`[Lic: ${licenseId}]`) || p.name?.includes(`[Lic: ${licenseId}]`)) return true;
        if (licenseId === 'main' && !p.code?.includes('[Lic: ') && !p.name?.includes('[Lic: ')) return true;
        return false;
      });
      prodErr = null;
    } else if (prodErr) {
      return NextResponse.json({ error: prodErr.message }, { status: 500 });
    }

    const prodList = products || [];
    const totalProducts = prodList.length;
    let totalOnHandUnits = 0;
    let totalValuation = 0;

    for (const p of prodList) {
      const qty = Number(p.quantity_on_hand || 0);
      const cost = Number(p.cost_price || p.unit_price || 0);
      totalOnHandUnits += qty;
      totalValuation += qty * cost;
    }

    // Fetch recent movements
    let moveQuery = admin.from('stock_movements').select('*').order('date', { ascending: false }).limit(20);
    if (!ctx.isPlatformAdmin && companyId) {
      moveQuery = moveQuery.eq('company_id', companyId);
    }
    if (licenseId && licenseId !== 'all') {
      try {
        moveQuery = moveQuery.eq('license_id', licenseId);
      } catch {
        // silent
      }
    }
    const { data: movements } = await moveQuery;

    return NextResponse.json({
      kpis: {
        totalProducts,
        totalOnHandUnits: Math.round(totalOnHandUnits * 100) / 100,
        totalValuation: Math.round(totalValuation * 100) / 100,
      },
      products: prodList,
      movements: movements || [],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const ctx = await authenticate(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const memberships = await getMemberships(ctx);
    const companyId = memberships[0]?.company_id;
    if (!companyId && !ctx.isPlatformAdmin) {
      return NextResponse.json({ error: 'No company associated with this account' }, { status: 403 });
    }

    const body = await req.json();
    const { action, license_id } = body;
    const admin = createAdminSupabase();

    if (action === 'add_product') {
      const { name, code, image_url, unit_of_measure = 'Unit', cost_price = 0, unit_price = 0, quantity_on_hand = 0 } = body;
      if (!name) return NextResponse.json({ error: 'Product name is required' }, { status: 400 });

      const prodPayload: Record<string, any> = {
        company_id: companyId,
        name,
        code: code || `SKU-${Date.now().toString().slice(-4)}`,
        image_url: image_url || null,
        unit_of_measure,
        cost_price: Number(cost_price),
        unit_price: Number(unit_price),
        quantity_on_hand: Number(quantity_on_hand),
      };
      if (license_id && license_id !== 'main') prodPayload.license_id = license_id;

      let product: any = null;
      const { data, error } = await admin.from('stock_products').insert(prodPayload).select().single();
      if (error) {
        if (prodPayload.license_id) {
          delete prodPayload.license_id;
          const retry = await admin.from('stock_products').insert(prodPayload).select().single();
          if (retry.error) return NextResponse.json({ error: retry.error.message }, { status: 500 });
          product = retry.data;
        } else {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
      } else {
        product = data;
      }

      return NextResponse.json({ success: true, product });
    }

    if (action === 'adjust_stock') {
      const { product_id, movement_type, quantity, reference } = body;
      if (!product_id || !quantity) {
        return NextResponse.json({ error: 'Product ID and quantity are required' }, { status: 400 });
      }

      const { data: prod } = await admin.from('stock_products').select('quantity_on_hand').eq('id', product_id).single();
      const currentQty = Number(prod?.quantity_on_hand || 0);
      const moveQty = Number(quantity);

      let newQty = currentQty;
      let signedQty = moveQty;
      if (movement_type === 'outgoing') {
        newQty = Math.max(0, currentQty - moveQty);
        signedQty = -moveQty;
      } else if (movement_type === 'incoming') {
        newQty = currentQty + moveQty;
        signedQty = moveQty;
      } else {
        newQty = moveQty;
        signedQty = moveQty - currentQty;
      }

      await admin.from('stock_products').update({ quantity_on_hand: newQty }).eq('id', product_id);

      const movePayload: Record<string, any> = {
        company_id: companyId,
        product_id,
        date: new Date().toISOString().split('T')[0],
        movement_type,
        quantity: Math.abs(moveQty),
        signed_quantity: signedQty,
        reference: reference || 'Manual adjustment',
        created_by: ctx.userId,
      };
      if (license_id && license_id !== 'main') movePayload.license_id = license_id;

      try {
        await admin.from('stock_movements').insert(movePayload);
      } catch {
        if (movePayload.license_id) {
          delete movePayload.license_id;
          await admin.from('stock_movements').insert(movePayload);
        }
      }

      return NextResponse.json({ success: true, updatedQuantity: newQty });
    }

    return NextResponse.json({ error: 'Unknown stock action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
