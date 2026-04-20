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

export async function GET() {
  try {
    await initDb();
    const db = await getDb();
    const [rows] = await db.execute('SELECT * FROM nota_pajak ORDER BY created_at DESC LIMIT 50');
    return NextResponse.json(rows);
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
        items = ?, tanggal_dokumen = ?, penandatangan = ?
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
