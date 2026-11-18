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

    const admin = createAdminSupabase();

    let prodQuery = admin.from('stock_products').select('*').order('name');
    if (!ctx.isPlatformAdmin && companyId) {
      prodQuery = prodQuery.eq('company_id', companyId);
    }

    const { data: products, error: prodErr } = await prodQuery;
    if (prodErr) return NextResponse.json({ error: prodErr.message }, { status: 500 });

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
    const {
      action = 'add_product',
      name,
      code,
      image_url,
      unit_of_measure = 'Unit',
      cost_price = 0,
      unit_price = 0,
      quantity_on_hand = 0,
      product_id,
      movement_type,
      quantity,
      reference,
      notes,
    } = body;

    const admin = createAdminSupabase();

    if (action === 'add_product') {
      if (!name) return NextResponse.json({ error: 'Product name is required' }, { status: 400 });

      // Deduplication check: prevent multiple rapid clicks inserting identical products
      if (code) {
        const { data: existingByCode } = await admin
          .from('stock_products')
          .select('*')
          .eq('company_id', companyId)
          .eq('code', code)
          .maybeSingle();

        if (existingByCode) {
          return NextResponse.json({
            success: true,
            product: existingByCode,
            message: 'Product with this code already exists (deduplicated).',
          });
        }
      }

      // Check by identical name created recently
      const { data: existingByName } = await admin
        .from('stock_products')
        .select('*')
        .eq('company_id', companyId)
        .eq('name', name)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingByName) {
        const timeDiff = Date.now() - new Date(existingByName.created_at).getTime();
        if (timeDiff < 10000) {
          // Created within 10 seconds, duplicate click suppression
          return NextResponse.json({
            success: true,
            product: existingByName,
            message: 'Duplicate click ignored. Existing product returned.',
          });
        }
      }

      const insertPayload: any = {
        company_id: companyId,
        name,
        code: code || null,
        unit_of_measure,
        cost_price: Number(cost_price || 0),
        unit_price: Number(unit_price || 0),
        quantity_on_hand: Number(quantity_on_hand || 0),
        is_storable: true,
        active: true,
      };

      if (image_url) {
        insertPayload.image_url = image_url;
      }

      const { data: product, error } = await admin
        .from('stock_products')
        .insert(insertPayload)
        .select()
        .single();

      if (error) {
        // If image_url column doesn't exist yet, retry without it
        if (error.message && error.message.includes('image_url')) {
          delete insertPayload.image_url;
          const { data: retryProduct, error: retryErr } = await admin
            .from('stock_products')
            .insert(insertPayload)
            .select()
            .single();
          if (retryErr) return NextResponse.json({ error: retryErr.message }, { status: 500 });
          return NextResponse.json({ success: true, product: retryProduct });
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // If initial stock was given, record movement
      if (Number(quantity_on_hand) > 0) {
        await admin.from('stock_movements').insert({
          company_id: companyId,
          product_id: product.id,
          movement_type: 'adjustment',
          reference: 'Initial Stock Count',
          quantity: Number(quantity_on_hand),
          unit_price: Number(cost_price || 0),
          status: 'done',
          date: new Date().toISOString().split('T')[0],
          created_by: ctx.userId,
        });
      }

      return NextResponse.json({ success: true, product });
    }

    if (action === 'adjust_stock') {
      if (!product_id || !quantity) {
        return NextResponse.json({ error: 'Product ID and Quantity are required' }, { status: 400 });
      }

      const numQty = Number(quantity);
      const moveType = movement_type || 'adjustment';

      // 1. Record movement
      await admin.from('stock_movements').insert({
        company_id: companyId,
        product_id,
        movement_type: moveType,
        reference: reference || 'Manual Stock Adjustment',
        quantity: Math.abs(numQty),
        status: 'done',
        date: new Date().toISOString().split('T')[0],
        created_by: ctx.userId,
      });

      // 2. Update product on_hand
      const { data: prod } = await admin
        .from('stock_products')
        .select('quantity_on_hand')
        .eq('id', product_id)
        .single();

      let currentQty = Number(prod?.quantity_on_hand || 0);
      if (moveType === 'incoming') {
        currentQty += Math.abs(numQty);
      } else if (moveType === 'outgoing') {
        currentQty -= Math.abs(numQty);
      } else {
        currentQty = Math.max(0, numQty);
      }

      const { data: updatedProd, error: updErr } = await admin
        .from('stock_products')
        .update({ quantity_on_hand: Math.max(0, currentQty) })
        .eq('id', product_id)
        .select()
        .single();

      if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

      return NextResponse.json({ success: true, product: updatedProd });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
