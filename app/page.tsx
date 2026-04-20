"use client";

import React, { useState, useRef, useMemo } from 'react';
import { 
  Plus, 
  Trash2, 
  Printer, 
  Download,
  FileText, 
  Upload, 
  Loader2, 
  AlertCircle,
  ArrowRight
} from 'lucide-react';
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { Container, Row, Col, Card, Form, Button, InputGroup, Alert, Spinner, Table } from 'react-bootstrap';

// Initialize Gemini lazily to avoid crashes if key is missing
const getAi = () => {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenerativeAI(apiKey);
};

// Types
interface TaxItem {
  id: string;
  description: string;
  amount: number;
}

interface TaxParty {
  name: string;
  address: string;
  npwp: string;
}

interface NotaData {
  nomor: string;
  fakturNomor: string;
  fakturTanggal: string;
  penerima: TaxParty;
  pemberi: TaxParty;
  items: TaxItem[];
  tanggalDokumen: string;
  penandatangan: string;
}

const initialData: NotaData = {
  nomor: '880/RT/02/2025-025/RT/02/2025',
  fakturNomor: '030.007-24.80471793',
  fakturTanggal: '2024-08-16',
  penerima: {
    name: 'PT PERTAMINA HULU ENERGI OFFSHORE NORTH WEST JAVA',
    address: 'GEDUNG PHE TOWER LT 3, JL TB SIMATUPANG KAV 99 Blok 00 No.00 RT:000 RW:000 Kel.KEBAGUSAN Kec.PASAR MINGGU Kota/Kab.JAKARTA SELATAN DKI JAKARTA 12520',
    npwp: '010613404081000'
  },
  pemberi: {
    name: 'PT PGAS Solution',
    address: 'Gedung C Lt.4 Jl, KH. Zainul Arifin No. 20 Jakarta Barat 11140. Indonesia',
    npwp: '029885225051000'
  },
  items: [
    {
      id: '1',
      description: 'PG00119 - Personnel & Rent tools to Install Celling Toilet at Foxtrot F/S (20 Mei 2024 s/d 01 Juni 2024) Rp 90.004.085 x 1',
      amount: 90004085
    }
  ],
  tanggalDokumen: '2025-02-13',
  penandatangan: 'PT Pertamina Hulu Energi ONWJ'
};

// Helpers
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatDateIndo = (dateStr: string) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
};

const renderNPWP = (npwp: string) => {
  // Clean dots/dashes and pad to 15 digits
  const digits = npwp.replace(/\D/g, '').padEnd(15, '0').split('');
  
  // Indonesian NPWP structure: 2-3-3-1-3-3
  const groups = [
    digits.slice(0, 2),
    digits.slice(2, 5),
    digits.slice(5, 8),
    digits.slice(8, 9),
    digits.slice(9, 12),
    digits.slice(12, 15)
  ];

  return (
    <div className="npwp-container">
      {groups.map((group, gIdx) => (
        <div key={gIdx} className="npwp-group">
          {group.map((digit, dIdx) => (
            <span key={dIdx} className="npwp-digit">{digit}</span>
          ))}
        </div>
      ))}
    </div>
  );
};

export default function Home() {
  const [data, setData] = useState<NotaData>(initialData);
  const [isExtracting, setIsExtracting] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const notaRef = useRef<HTMLDivElement>(null);

  const totalAmount = useMemo(() => {
    return data.items.reduce((sum, item) => sum + item.amount, 0);
  }, [data.items]);

  const ppnAmount = useMemo(() => {
    return Math.floor(totalAmount * 0.11);
  }, [totalAmount]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    if (!notaRef.current) return;
    
    const html2pdf = (await import('html2pdf.js')).default;
    const element = notaRef.current;
    const opt = {
      margin: 0,
      filename: `Nota_Pembatalan_${data.nomor.replace(/\//g, '_')}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    } as const;

    html2pdf().set(opt).from(element).save();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsExtracting(true);
    setUploadError(null);

    try {
      const aiClient = getAi();
      if (!aiClient) {
        throw new Error("Gemini API Key is not configured in Vercel. Please add NEXT_PUBLIC_GEMINI_API_KEY to your Environment Variables.");
      }
      
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = (reader.result as string).split(',')[1];
        
        try {
          const model = aiClient.getGenerativeModel({ 
            model: "gemini-1.5-flash", 
            generationConfig: {
              responseMimeType: "application/json",
              responseSchema: {
                type: SchemaType.OBJECT,
                properties: {
                  nomorNota: { type: SchemaType.STRING },
                  fakturNomor: { type: SchemaType.STRING },
                  fakturTanggal: { type: SchemaType.STRING },
                  penerimaName: { type: SchemaType.STRING },
                  penerimaAddress: { type: SchemaType.STRING },
                  penerimaNpwp: { type: SchemaType.STRING },
                  pemberiName: { type: SchemaType.STRING },
                  pemberiAddress: { type: SchemaType.STRING },
                  pemberiNpwp: { type: SchemaType.STRING },
                  tanggalNota: { type: SchemaType.STRING },
                  items: {
                    type: SchemaType.ARRAY,
                    items: {
                      type: SchemaType.OBJECT,
                      properties: {
                        description: { type: SchemaType.STRING },
                        amount: { type: SchemaType.NUMBER }
                      },
                      required: ["description", "amount"]
                    }
                  }
                },
                required: ["fakturNomor", "fakturTanggal", "penerimaName", "penerimaNpwp", "items"]
              }
            }
          });

          const result = await model.generateContent([
            "Anda adalah pakar pajak Indonesia. Ekstrak data dari gambar Faktur Pajak ini dan kembalikan dalam format JSON murni. Pastikan NPWP adalah deretan angka (15 digit). Item harus berisi deskripsi lengkap dan nominal angka tanpa tanda pemisah di JSON.",
            {
              inlineData: {
                data: base64Data,
                mimeType: file.type
              }
            }
          ]);

          const text = result.response.text();
          const extracted: any = JSON.parse(text);
          
          setData(prev => ({
            ...prev,
            nomor: extracted.nomorNota || prev.nomor,
            fakturNomor: extracted.fakturNomor || prev.fakturNomor,
            fakturTanggal: extracted.fakturTanggal || prev.fakturTanggal,
            penerima: {
              name: extracted.penerimaName || prev.penerima.name,
              address: extracted.penerimaAddress || prev.penerima.address,
              npwp: (extracted.penerimaNpwp || '').replace(/\D/g, '').slice(0, 15)
            },
            pemberi: {
              name: extracted.pemberiName || prev.pemberi.name,
              address: extracted.pemberiAddress || prev.pemberi.address,
              npwp: (extracted.pemberiNpwp || '').replace(/\D/g, '').slice(0, 15)
            },
            items: extracted.items ? extracted.items.map((it: any) => ({
              id: Math.random().toString(36).substr(2, 9),
              description: it.description,
              amount: it.amount
            })) : prev.items
          }));

        } catch (err: any) {
          console.error("Gemini Error:", err);
          setUploadError("Gagal menganalisis dokumen. Gunakan gambar faktur yang jelas.");
        } finally {
          setIsExtracting(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setIsExtracting(false);
      setUploadError("Gagal membaca file.");
    }
  };

  const updatePenerima = (field: keyof TaxParty, value: string) => {
    setData(prev => ({
      ...prev,
      penerima: { ...prev.penerima, [field]: value }
    }));
  };

  const updatePemberi = (field: keyof TaxParty, value: string) => {
    setData(prev => ({
      ...prev,
      pemberi: { ...prev.pemberi, [field]: value }
    }));
  };

  const addItem = () => {
    setData(prev => ({
      ...prev,
      items: [
        ...prev.items,
        { id: Math.random().toString(36).substr(2, 9), description: '', amount: 0 }
      ]
    }));
  };

  const removeItem = (id: string) => {
    if (data.items.length === 1) return;
    setData(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== id)
    }));
  };

  const updateItem = (id: string, field: keyof TaxItem, value: any) => {
    setData(prev => ({
      ...prev,
      items: prev.items.map(item => item.id === id ? { ...item, [field]: value } : item)
    }));
  };

  return (
    <div className="pb-5">
      {/* Header Navbar */}
      <nav className="navbar navbar-expand-lg navbar-dark bg-primary mb-4 no-print shadow-sm">
        <Container>
          <span className="navbar-brand d-flex align-items-center gap-2 font-weight-bold">
            <FileText size={24} />
            Nota Pembatalan Pajak Generator
          </span>
          <div className="ms-auto d-flex gap-2">
            <Button variant="light" size="sm" onClick={() => setData(initialData)}>Reset</Button>
            <Button variant="info" onClick={handleDownloadPDF} className="fw-bold d-flex align-items-center gap-2 text-white">
              <Download size={18} /> Download PDF (A4)
            </Button>
            <Button variant="warning" onClick={handlePrint} className="fw-bold d-flex align-items-center gap-2">
              <Printer size={18} /> Cetak Nota
            </Button>
          </div>
        </Container>
      </nav>

      <Container fluid="lg">
        <Row className="g-4">
          {/* Form Side */}
          <Col xl={6} className="no-print">
            <Card className="mb-4 border-primary border-2">
              <Card.Header className="bg-primary text-white d-flex align-items-center gap-2">
                <Upload size={20} />
                <h5 className="mb-0">Automasi Via Faktur Pajak</h5>
              </Card.Header>
              <Card.Body className="text-center py-4 bg-light">
                <p className="text-muted small mb-4">
                  Hemat waktu dengan mengunggah gambar/PDF Faktur Pajak. AI akan mengisi form secara otomatis.
                </p>
                <div className="d-flex flex-column align-items-center">
                  <Form.Group controlId="formFile" className="mb-3">
                    <Form.Control 
                      type="file" 
                      accept="image/*,application/pdf"
                      onChange={handleFileUpload}
                      disabled={isExtracting}
                    />
                  </Form.Group>
                  {isExtracting && (
                    <div className="d-flex align-items-center gap-2 text-primary">
                      <Spinner animation="border" size="sm" />
                      <span>Sedang menganalisis dokumen...</span>
                    </div>
                  )}
                  {uploadError && (
                    <Alert variant="danger" className="mt-2 py-2 small d-flex align-items-center gap-2">
                      <AlertCircle size={16} /> {uploadError}
                    </Alert>
                  )}
                </div>
              </Card.Body>
            </Card>

            <Card className="mb-4 shadow-sm">
              <Card.Header className="bg-dark text-white font-weight-bold">Informasi Faktur & Nota</Card.Header>
              <Card.Body>
                <Row className="g-3">
                  <Col md={12}>
                    <Form.Label className="small fw-bold">Nomor Nota Pembatalan</Form.Label>
                    <Form.Control 
                      type="text" 
                      value={data.nomor}
                      onChange={(e) => setData({...data, nomor: e.target.value})}
                    />
                  </Col>
                  <Col md={6}>
                    <Form.Label className="small fw-bold">Nomor Faktur Pajak</Form.Label>
                    <Form.Control 
                      type="text" 
                      value={data.fakturNomor}
                      onChange={(e) => setData({...data, fakturNomor: e.target.value})}
                    />
                  </Col>
                  <Col md={6}>
                    <Form.Label className="small fw-bold">Tanggal Faktur</Form.Label>
                    <Form.Control 
                      type="date" 
                      value={data.fakturTanggal}
                      onChange={(e) => setData({...data, fakturTanggal: e.target.value})}
                    />
                  </Col>
                </Row>
              </Card.Body>
            </Card>

            <Card className="mb-4 shadow-sm">
              <Card.Header className="bg-secondary text-white font-weight-bold">Penerima Jasa (Client)</Card.Header>
              <Card.Body>
                <Form.Group className="mb-3">
                  <Form.Label className="small fw-bold">Nama Perusahaan</Form.Label>
                  <Form.Control 
                    type="text" 
                    value={data.penerima.name}
                    onChange={(e) => updatePenerima('name', e.target.value)}
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label className="small fw-bold">NPWP (15 Digit)</Form.Label>
                  <Form.Control 
                    type="text" 
                    value={data.penerima.npwp}
                    onChange={(e) => updatePenerima('npwp', e.target.value)}
                    placeholder="000000000000000"
                  />
                </Form.Group>
                <Form.Group className="mb-0">
                  <Form.Label className="small fw-bold">Alamat</Form.Label>
                  <Form.Control 
                    as="textarea"
                    rows={3}
                    value={data.penerima.address}
                    onChange={(e) => updatePenerima('address', e.target.value)}
                  />
                </Form.Group>
              </Card.Body>
            </Card>

            <Card className="mb-4 shadow-sm">
              <Card.Header className="bg-secondary text-white font-weight-bold">Pemberi Jasa (Provider)</Card.Header>
              <Card.Body>
                <Form.Group className="mb-3">
                  <Form.Label className="small fw-bold">Nama Perusahaan</Form.Label>
                  <Form.Control 
                    type="text" 
                    value={data.pemberi.name}
                    onChange={(e) => updatePemberi('name', e.target.value)}
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label className="small fw-bold">NPWP (15 Digit)</Form.Label>
                  <Form.Control 
                    type="text" 
                    value={data.pemberi.npwp}
                    onChange={(e) => updatePemberi('npwp', e.target.value)}
                    placeholder="000000000000000"
                  />
                </Form.Group>
                <Form.Group className="mb-0">
                  <Form.Label className="small fw-bold">Alamat</Form.Label>
                  <Form.Control 
                    as="textarea"
                    rows={2}
                    value={data.pemberi.address}
                    onChange={(e) => updatePemberi('address', e.target.value)}
                  />
                </Form.Group>
              </Card.Body>
            </Card>

            <Card className="mb-4 shadow-sm">
              <Card.Header className="bg-info text-white d-flex justify-content-between align-items-center">
                <h6 className="mb-0 fw-bold">Rincian Jasa Dibatalkan</h6>
                <Button variant="light" size="sm" onClick={addItem}><Plus size={16} /> Tambah Item</Button>
              </Card.Header>
              <Card.Body>
                {data.items.map((item, index) => (
                  <div key={item.id} className="p-3 border rounded mb-3 bg-light position-relative">
                    <Button 
                      variant="link" 
                      className="position-absolute top-0 end-0 text-danger p-1" 
                      onClick={() => removeItem(item.id)}
                    >
                      <Trash2 size={16} />
                    </Button>
                    <Form.Group className="mb-2">
                      <Form.Label className="small fw-bold">Deskripsi Jasa #{index + 1}</Form.Label>
                      <Form.Control 
                        as="textarea"
                        rows={2}
                        value={item.description}
                        onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                        placeholder="Uraian jasa..."
                      />
                    </Form.Group>
                    <Form.Group>
                      <Form.Label className="small fw-bold">Nominal (Rp)</Form.Label>
                      <Form.Control 
                        type="number" 
                        value={item.amount}
                        onChange={(e) => updateItem(item.id, 'amount', Number(e.target.value))}
                      />
                    </Form.Group>
                  </div>
                ))}
              </Card.Body>
            </Card>

            <Card className="mb-4 shadow-sm">
              <Card.Header className="bg-dark text-white font-weight-bold">Pengesahan</Card.Header>
              <Card.Body>
                <Row className="g-3">
                  <Col md={6}>
                    <Form.Label className="small fw-bold">Tanggal Nota</Form.Label>
                    <Form.Control 
                      type="date" 
                      value={data.tanggalDokumen}
                      onChange={(e) => setData({...data, tanggalDokumen: e.target.value})}
                    />
                  </Col>
                  <Col md={6}>
                    <Form.Label className="small fw-bold">Nama Penandatangan</Form.Label>
                    <Form.Control 
                      type="text" 
                      value={data.penandatangan}
                      onChange={(e) => setData({...data, penandatangan: e.target.value})}
                    />
                  </Col>
                </Row>
              </Card.Body>
            </Card>

            <div className="tips-section d-flex align-items-start gap-3">
              <AlertCircle className="text-primary mt-1" size={24} />
              <div>
                <h6 className="fw-bold mb-1">Panduan Cetak PDF</h6>
                <p className="small text-muted mb-0">
                  Untuk hasil terbaik, pilih <strong>&quot;Microsoft Print to PDF&quot;</strong> atau <strong>&quot;Save as PDF&quot;</strong>. 
                  Pastikan opsi <strong>&quot;Headers &amp; Footers&quot;</strong> dinonaktifkan di pengaturan browser Anda.
                </p>
              </div>
            </div>
          </Col>

          {/* Preview Side */}
          <Col xl={6} className="d-flex justify-content-center">
            <div className="document-container" ref={notaRef}>
              <div className="text-center mb-4">
                <h3 className="text-uppercase fw-bold text-decoration-underline mb-1">Nota Pembatalan</h3>
                <p className="mb-0">Nomor : {data.nomor}</p>
              </div>

              <table className="document-table mb-0">
                <tbody>
                  <tr>
                    <td style={{ width: '65%' }}>
                      <div className="d-flex align-items-start">
                        <div style={{ width: '190px', flexShrink: 0 }}>Atas Faktur Pajak Nomor</div>
                        <div style={{ width: '20px', textAlign: 'center', flexShrink: 0 }}>:</div>
                        <div className="fw-bold">{data.fakturNomor}</div>
                      </div>
                    </td>
                    <td>
                      <div className="d-flex align-items-start">
                        <div style={{ width: '75px', flexShrink: 0 }}>Tanggal</div>
                        <div style={{ width: '20px', textAlign: 'center', flexShrink: 0 }}>:</div>
                        <div className="text-nowrap">{formatDateIndo(data.fakturTanggal)}</div>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={2} className="text-center fw-bold bg-light uppercase">Penerima Jasa Kena Pajak</td>
                  </tr>
                  <tr>
                    <td colSpan={2} className="p-0 border-0">
                      <div className="p-3">
                        <div className="d-flex mb-2 align-items-start">
                          <div style={{ width: '100px', flexShrink: 0 }}>Nama</div>
                          <div style={{ width: '20px', textAlign: 'center', flexShrink: 0 }}>:</div>
                          <div className="fw-bold text-uppercase">{data.penerima.name}</div>
                        </div>
                        <div className="d-flex mb-2 align-items-start">
                          <div style={{ width: '100px', flexShrink: 0 }}>Alamat</div>
                          <div style={{ width: '20px', textAlign: 'center', flexShrink: 0 }}>:</div>
                          <div className="text-uppercase">{data.penerima.address}</div>
                        </div>
                        <div className="d-flex align-items-center">
                          <div style={{ width: '100px', flexShrink: 0 }}>NPWP</div>
                          <div style={{ width: '20px', textAlign: 'center', flexShrink: 0 }}>:</div>
                          {renderNPWP(data.penerima.npwp)}
                        </div>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={2} className="text-center fw-bold bg-light uppercase">Kepada Pemberi Jasa Kena Pajak</td>
                  </tr>
                  <tr>
                    <td colSpan={2} className="p-0 border-0">
                      <div className="p-3">
                        <div className="d-flex mb-2 align-items-start">
                          <div style={{ width: '100px', flexShrink: 0 }}>Nama</div>
                          <div style={{ width: '20px', textAlign: 'center', flexShrink: 0 }}>:</div>
                          <div className="fw-bold text-uppercase">{data.pemberi.name}</div>
                        </div>
                        <div className="d-flex mb-2 align-items-start">
                          <div style={{ width: '100px', flexShrink: 0 }}>Alamat</div>
                          <div style={{ width: '20px', textAlign: 'center', flexShrink: 0 }}>:</div>
                          <div className="text-uppercase">{data.pemberi.address}</div>
                        </div>
                        <div className="d-flex align-items-center">
                          <div style={{ width: '100px', flexShrink: 0 }}>NPWP</div>
                          <div style={{ width: '20px', textAlign: 'center', flexShrink: 0 }}>:</div>
                          {renderNPWP(data.pemberi.npwp)}
                        </div>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>

              <table className="document-table border-top-0">
                <thead>
                  <tr className="text-center fw-bold">
                    <th style={{ width: '50px' }}>No. Urut</th>
                    <th>Jasa Kena Pajak yang dibatalkan</th>
                    <th style={{ width: '130px' }}>Penggantian JKP (Rp)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item, idx) => (
                    <tr key={item.id}>
                      <td className="text-center align-top">{idx + 1}</td>
                      <td className="align-top">
                        <div style={{ minHeight: '100px', whiteSpace: 'pre-wrap' }}>
                          {item.description}
                        </div>
                      </td>
                      <td className="text-end align-top">{formatCurrency(item.amount)}</td>
                    </tr>
                  ))}
                  <tr className="fw-bold">
                    <td colSpan={2} className="text-end">Jumlah Penggantian JKP yang dibatalkan</td>
                    <td className="text-end">{formatCurrency(totalAmount)}</td>
                  </tr>
                  <tr className="fw-bold">
                    <td colSpan={2} className="text-end">PPN yang diminta kembali</td>
                    <td className="text-end">{formatCurrency(ppnAmount)}</td>
                  </tr>
                </tbody>
              </table>

              <div className="mt-auto pt-4 d-flex flex-column align-items-end">
                <div className="text-center" style={{ minWidth: '250px' }}>
                  <p className="mb-1">Jakarta, {formatDateIndo(data.tanggalDokumen)}</p>
                  <p className="fw-bold mb-0">{data.penandatangan}</p>
                  <div style={{ height: '70px' }}></div>
                </div>
              </div>
            </div>
          </Col>
        </Row>
      </Container>

      <footer className="mt-5 py-4 border-top text-center no-print text-muted small">
        <Container>
           &copy; {new Date().getFullYear()} Nota Pembatalan Generator &bull; Built with Next.js & Bootstrap
        </Container>
      </footer>
    </div>
  );
}
