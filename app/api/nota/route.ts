import { NextResponse } from 'next/server';
import { getDb, initDb } from '@/lib/db';

function parseIndoDateToISO(dateStr: any): string | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  
  // Clean string
  const cleanStr = dateStr.trim();
  
  // If it's already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleanStr)) return cleanStr;

  const months: Record<string, string> = {
    'januari': '01', 'februari': '02', 'maret': '03', 'april': '04', 'mei': '05', 'juni': '06',
    'juli': '07', 'agustus': '08', 'september': '09', 'oktober': '10', 'november': '11', 'desember': '12'
  };

  try {
    // Attempt to parse format "DD Month YYYY" (e.g., 12 Januari 2026)
    const parts = cleanStr.toLowerCase().split(/\s+/);
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = months[parts[1]];
      const year = parts[2];
      if (day && month && year && /^\d{2}$/.test(day) && /^\d{4}$/.test(year)) {
        return `${year}-${month}-${day}`;
      }
    }

    // Try standard Date parsing as fallback
    const d = new Date(cleanStr);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
  } catch (e) {
    console.warn('Failed to parse date:', cleanStr);
  }

  return cleanStr;
}

export async function GET(request: Request) {
  try {
    await initDb();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;

    const db = await getDb();
    
    let query = 'SELECT * FROM nota_pajak';
    let countQuery = 'SELECT COUNT(*) as total FROM nota_pajak';
    const params: any[] = [];
    const countParams: any[] = [];

    if (search) {
      const searchPattern = `%${search}%`;
      const whereClause = ' WHERE nomor LIKE ? OR faktur_nomor LIKE ? OR penerima_name LIKE ?';
      query += whereClause;
      countQuery += whereClause;
      params.push(searchPattern, searchPattern, searchPattern);
      countParams.push(searchPattern, searchPattern, searchPattern);
    }

    query += ` ORDER BY updated_at DESC LIMIT ${limit} OFFSET ${offset}`;
    
    // Aggregation query for totals
    let totalsQuery = 'SELECT SUM(t.total_amount) as grand_total, SUM(t.total_ppn) as grand_ppn FROM (SELECT nomor, CAST(JSON_EXTRACT(items, "$[*].amount") AS SIGNED) as total_amount, 0 as total_ppn FROM nota_pajak) as t';
    // Actually, items is a JSON array, SUM on JSON_EXTRACT might be tricky in pure MySQL depending on version.
    // Better: let's just sum the stored values if we had them, OR we can calculate in JS after fetching ALL if we really wanted to.
    // BUT since we store items as JSON, a better way is to iterate over the items in the JS layer for the results being returned.
    // However, the user wants "Total for the filter".
    
    // Let's keep it simple: fetch the rows and count first.
    // For totals of the WHOLE matched set, I'd need a more complex query or a structured schema.
    // Given the current schema, let's just calculate totals for the current page and provide a placeholder for "Full Set Totals".
    
    const [rows]: any = await db.query(query, params);
    const [countRows]: any = await db.query(countQuery, countParams);
    
    const total = countRows[0].total;
    const totalPages = Math.ceil(total / limit);

    // Aggregation query for totals (summing DPP and PPN)
    // Note: We need to parse the JSON items to sum amounts. 
    // In MySQL, we can use JSON_TABLE or just calculate in JS if performance allows.
    // For simplicity and accuracy with the current JSON schema, let's fetch IDs matching the filter first, 
    // but calculating grand totals on JSON items in MySQL is version-dependent.
    // Let's do a trick: fetch all matching amounts and calculate in JS for the grand totals.
    // (This is okay for moderate datasets, e.g. < 10k records)
    
    const [allMatchingRows]: any = await db.query(`SELECT items, ppn_manual FROM nota_pajak ${search ? ' WHERE nomor LIKE ? OR faktur_nomor LIKE ? OR penerima_name LIKE ?' : ''}`, search ? [params[0], params[1], params[2]] : []);
    
    let grandTotalDPP = 0;
    let grandTotalPPN = 0;
    
    allMatchingRows.forEach((item: any) => {
      const items = typeof item.items === 'string' ? JSON.parse(item.items) : item.items;
      const dpp = items.reduce((sum: number, i: any) => sum + i.amount, 0);
      const ppn = item.ppn_manual ? Number(item.ppn_manual) : Math.floor(dpp * 0.11);
      grandTotalDPP += dpp;
      grandTotalPPN += ppn;
    });

    return NextResponse.json({
      data: rows,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        grandTotalDPP,
        grandTotalPPN
      }
    });
  } catch (error: any) {
    console.error('Database Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await initDb();
    const data = await request.json();
    const db = await getDb();

    const fakturTanggal = parseIndoDateToISO(data.fakturTanggal);
    const tanggalDokumen = parseIndoDateToISO(data.tanggalDokumen);
    
    const [result] = await db.execute(
      `INSERT INTO nota_pajak (
        nomor, faktur_nomor, faktur_tanggal, 
        penerima_name, penerima_address, penerima_npwp,
        pemberi_name, pemberi_address, pemberi_npwp,
        items, tanggal_dokumen, kota_dokumen, ppn_manual, penandatangan
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.nomor,
        data.fakturNomor,
        fakturTanggal,
        data.penerima.name,
        data.penerima.address,
        data.penerima.npwp,
        data.pemberi.name,
        data.pemberi.address,
        data.pemberi.npwp,
        JSON.stringify(data.items),
        tanggalDokumen,
        data.kotaDokumen || 'Jakarta',
        data.ppnManual || null,
        data.penandatangan
      ]
    );
    
    return NextResponse.json({ id: (result as any).insertId });
  } catch (error: any) {
    console.error('API POST Error:', error);
    return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    await initDb();
    const { id, ...data } = await request.json();
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    
    const db = await getDb();
    const fakturTanggal = parseIndoDateToISO(data.fakturTanggal);
    const tanggalDokumen = parseIndoDateToISO(data.tanggalDokumen);

    await db.execute(
      `UPDATE nota_pajak SET 
        nomor = ?, faktur_nomor = ?, faktur_tanggal = ?, 
        penerima_name = ?, penerima_address = ?, penerima_npwp = ?,
        pemberi_name = ?, pemberi_address = ?, pemberi_npwp = ?,
        items = ?, tanggal_dokumen = ?, kota_dokumen = ?, ppn_manual = ?, penandatangan = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [
        data.nomor,
        data.fakturNomor,
        fakturTanggal,
        data.penerima.name,
        data.penerima.address,
        data.penerima.npwp,
        data.pemberi.name,
        data.pemberi.address,
        data.pemberi.npwp,
        JSON.stringify(data.items),
        tanggalDokumen,
        data.kotaDokumen || 'Jakarta',
        data.ppnManual || null,
        data.penandatangan,
        id
      ]
    );
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('API PUT Error:', error);
    return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await initDb();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    
    const db = await getDb();
    await db.execute('DELETE FROM nota_pajak WHERE id = ?', [id]);
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('API DELETE Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
