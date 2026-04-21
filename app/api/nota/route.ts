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
    
    // Using .query instead of .execute because many MySQL drivers/proxies 
    // have issues with placeholders in LIMIT/OFFSET clauses
    const [rows]: any = await db.query(query, params);
    const [countRows]: any = await db.query(countQuery, countParams);
    
    const total = countRows[0].total;
    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      data: rows,
      pagination: {
        total,
        page,
        limit,
        totalPages
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
        items, tanggal_dokumen, penandatangan
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        items = ?, tanggal_dokumen = ?, penandatangan = ?,
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
