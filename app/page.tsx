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
  ArrowRight,
  ArrowLeft,
  History,
  Save,
  CheckCircle2,
  FileCheck2,
  Search,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Lock,
  ShieldCheck,
  Eye,
  EyeOff,
  Mail,
  Key,
  Gamepad2,
  Fingerprint,
  Smartphone,
  LogOut
} from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";
import { motion, AnimatePresence } from "motion/react";
import { Container, Row, Col, Card, Form, Button, InputGroup, Alert, Spinner, Table, Tabs, Tab, Modal, Badge } from 'react-bootstrap';
import * as speakeasy from 'speakeasy';
import { QRCodeCanvas } from 'qrcode.react';

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY as string });

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
  kotaDokumen: string;
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
  kotaDokumen: 'Jakarta',
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
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('generator');
  const [history, setHistory] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  
  // Pagination & Search States
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [historyLimit] = useState(10);

  // Authentication States
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passInput, setPassInput] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loginError, setLoginError] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isIdle, setIsIdle] = useState(false);
  const [authStep, setAuthStep] = useState(1); // 1: Password, 2: Google Authenticator (TOTP)
  const [totpCode, setTotpCode] = useState('');
  const [totpError, setTotpError] = useState(false);
  const [showQR, setShowQR] = useState(false);
  
  const IDLE_TIMEOUT = 5 * 60 * 1000; // 5 minutes
  
  // Shared TOTP Secret for the Billing Team
  const TOTP_SECRET = process.env.NEXT_PUBLIC_TOTP_SECRET || 'PGASBILLING2026SECRETKEY';
  const appName = 'PGAS Nota Generator';
  const userName = 'Billing Team';
  const qrValue = speakeasy.otpauthURL({
    secret: TOTP_SECRET,
    label: userName,
    issuer: appName,
    encoding: 'ascii'
  });

  const notaRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    // Check session storage on mount
    const authStatus = sessionStorage.getItem('billing_auth');
    const totpStatus = sessionStorage.getItem('totp_auth');
    if (authStatus === 'true' && totpStatus === 'true') {
      setIsAuthenticated(true);
    } else if (authStatus === 'true') {
      setAuthStep(2);
    }
    setIsCheckingAuth(false);
  }, []);

  // Idle Timer Logic
  React.useEffect(() => {
    if (!isAuthenticated) return;

    let idleTimer: NodeJS.Timeout;

    const resetTimer = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        handleLogout();
      }, IDLE_TIMEOUT);
    };

    const handleLogout = () => {
      setIsAuthenticated(false);
      setAuthStep(1);
      setPassInput('');
      setTotpCode('');
      sessionStorage.removeItem('billing_auth');
      sessionStorage.removeItem('totp_auth');
      setIsIdle(true);
    };

    // Events to track activity
    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('mousedown', resetTimer);
    window.addEventListener('keypress', resetTimer);
    window.addEventListener('scroll', resetTimer);
    window.addEventListener('touchstart', resetTimer);

    resetTimer();

    return () => {
      clearTimeout(idleTimer);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('mousedown', resetTimer);
      window.removeEventListener('keypress', resetTimer);
      window.removeEventListener('scroll', resetTimer);
      window.removeEventListener('touchstart', resetTimer);
    };
  }, [isAuthenticated]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const correctPassword = process.env.NEXT_PUBLIC_APP_PASSWORD || 'PGAS2026';
    if (passInput === correctPassword) {
      setAuthStep(2);
      sessionStorage.setItem('billing_auth', 'true');
      setLoginError(false);
    } else {
      setLoginError(true);
      setTimeout(() => setLoginError(false), 500);
    }
  };

  const handleGoogleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const isValid = speakeasy.totp.verify({
        secret: TOTP_SECRET,
        encoding: 'ascii',
        token: totpCode,
        window: 1 // Allow 30s before/after
      });
      
      if (isValid) {
        setIsAuthenticated(true);
        sessionStorage.setItem('totp_auth', 'true');
        setIsIdle(false);
        setTotpError(false);
      } else {
        setTotpError(true);
        setTimeout(() => setTotpError(false), 500);
      }
    } catch (err) {
      console.error("TOTP Verification error:", err);
      setTotpError(true);
    }
  };

  const handleRequestKey = () => {
    const subject = encodeURIComponent('Request Akses Key: Generator Nota Pajak');
    const body = encodeURIComponent('Halo Team Billing,\n\nMohon bantuannya untuk menginformasikan Password Akses untuk aplikasi Generator Nota Pajak.\n\nTerima kasih.');
    const emails = 'firka.edmianti@pgnsolution.co.id,tirto.lutvi@pgn-solution.co.id';
    window.location.href = `mailto:${emails}?subject=${subject}&body=${body}`;
  };

  React.useEffect(() => {
    if (isAuthenticated && activeTab === 'history') {
      fetchHistory(currentPage, searchQuery);
    }
  }, [activeTab, currentPage, searchQuery]);

  const fetchHistory = async (page = 1, search = '') => {
    setIsLoadingHistory(true);
    setHistoryError(null);
    try {
      const res = await fetch(`/api/nota?page=${page}&limit=${historyLimit}&search=${encodeURIComponent(search)}`);
      const result = await res.json();
      if (res.ok && result.data) {
        setHistory(result.data);
        setTotalPages(result.pagination.totalPages);
        setCurrentPage(result.pagination.page);
      } else {
        setHistoryError(result.error || "Gagal memuat riwayat data.");
      }
    } catch (err: any) {
      console.error("Failed to fetch history:", err);
      setHistoryError(err.message || "Gagal menghubungi server.");
    } finally {
      setIsLoadingHistory(true); // Wait for state updates
      setIsLoadingHistory(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(searchInput);
    setCurrentPage(1); // Reset to first page on search
  };

  const handleSaveToDb = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    setSaveError(null);
    try {
      const res = await fetch('/api/nota', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingId ? { ...data, id: editingId } : data)
      });
      const result = await res.json();
      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
        fetchHistory();
      } else {
        setSaveError(result.error || "Gagal menyimpan data ke database.");
      }
    } catch (err: any) {
      console.error("Failed to save:", err);
      setSaveError(err.message || "Terjadi kesalahan saat menghubungkan ke database.");
    } finally {
      setIsSaving(false);
    }
  };

  const loadFromHistory = (item: any) => {
    setEditingId(item.id);
    const formattedItem: NotaData = {
      nomor: item.nomor,
      fakturNomor: item.faktur_nomor,
      fakturTanggal: item.faktur_tanggal ? new Date(item.faktur_tanggal).toISOString().split('T')[0] : '',
      penerima: {
        name: item.penerima_name,
        address: item.penerima_address,
        npwp: item.penerima_npwp
      },
      pemberi: {
        name: item.pemberi_name,
        address: item.pemberi_address,
        npwp: item.pemberi_npwp
      },
      items: typeof item.items === 'string' ? JSON.parse(item.items) : item.items,
      tanggalDokumen: item.tanggal_dokumen ? new Date(item.tanggal_dokumen).toISOString().split('T')[0] : '',
      kotaDokumen: item.kota_dokumen || 'Jakarta',
      penandatangan: item.penandatangan
    };
    setData(formattedItem);
    setActiveTab('generator');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Apakah Anda yakin ingin menghapus data ini dari history?')) return;
    
    try {
      const res = await fetch(`/api/nota?id=${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        if (editingId === id) setEditingId(null);
        fetchHistory();
      } else {
        const result = await res.json();
        alert(result.error || "Gagal menghapus data.");
      }
    } catch (err) {
      console.error("Failed to delete:", err);
      alert("Terjadi kesalahan saat menghapus data.");
    }
  };

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
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = (reader.result as string).split(',')[1];
        
        try {
          const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: {
              parts: [
                {
                  text: "Anda adalah pakar pajak Indonesia. Ekstrak data dari gambar Faktur Pajak ini dan kembalikan dalam format JSON murni. Pastikan NPWP adalah deretan angka (15 digit). Item harus berisi deskripsi lengkap dan nominal angka tanpa tanda pemisah di JSON."
                },
                {
                  inlineData: {
                    data: base64Data,
                    mimeType: file.type
                  }
                }
              ]
            },
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  nomorNota: { type: Type.STRING },
                  fakturNomor: { type: Type.STRING },
                  fakturTanggal: { type: Type.STRING },
                  penerimaName: { type: Type.STRING },
                  penerimaAddress: { type: Type.STRING },
                  penerimaNpwp: { type: Type.STRING },
                  pemberiName: { type: Type.STRING },
                  pemberiAddress: { type: Type.STRING },
                  pemberiNpwp: { type: Type.STRING },
                  kotaDokumen: { type: Type.STRING },
                  items: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        description: { type: Type.STRING },
                        amount: { type: Type.NUMBER }
                      },
                      required: ["description", "amount"]
                    }
                  }
                },
                required: ["fakturNomor", "fakturTanggal", "penerimaName", "penerimaNpwp", "items"]
              }
            }
          });

          const extracted: any = JSON.parse(response.text);
          
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
            kotaDokumen: extracted.kotaDokumen || prev.kotaDokumen,
            items: extracted.items.map((it: any) => ({
              id: Math.random().toString(36).substr(2, 9),
              description: it.description,
              amount: it.amount
            }))
          }));

          setUploadSuccess(true);
          setTimeout(() => setUploadSuccess(false), 4000);

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
      {/* Authentication Overlay */}
      <AnimatePresence>
        {(!isAuthenticated && !isCheckingAuth) && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="security-overlay d-flex align-items-center justify-content-center p-3"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", damping: 20 }}
            >
              <Card className="login-card border-0 shadow-lg overflow-hidden" style={{ width: '100%', maxWidth: '420px' }}>
                <div className="bg-dark text-white p-4 text-center border-bottom border-primary border-4">
                  <div className="bg-primary d-inline-flex p-3 rounded-circle shadow-sm mb-3">
                    {authStep === 1 ? <Lock size={32} /> : <Fingerprint size={32} />}
                  </div>
                  <h4 className="fw-bold mb-1">
                    {authStep === 1 ? 'Akses Terbatas' : 'Verifikasi Google'}
                  </h4>
                  <p className="small text-muted mb-0">
                    {authStep === 1 
                      ? 'Langkah 1: Masukkan Password Sistem' 
                      : 'Langkah 2: Gunakan Akun Google PGAS'
                    }
                  </p>
                </div>
                <Card.Body className="p-4">
                  {isIdle && (
                    <Alert variant="warning" className="small py-2 text-center border-0 mb-4 shadow-sm">
                      <div className="d-flex align-items-center justify-content-center gap-2">
                         <Smartphone size={16} /> Sesi Anda berakhir karena tidak ada aktivitas.
                      </div>
                    </Alert>
                  )}

                  {authStep === 1 ? (
                    <Form onSubmit={handleLogin}>
                      <Form.Group className="mb-3">
                        <Form.Label className="small fw-bold text-muted text-uppercase">Password Akses</Form.Label>
                        <InputGroup className={`shadow-sm transition-all ${loginError ? 'shake-animation border-danger border' : ''}`}>
                          <InputGroup.Text className="bg-white border-end-0">
                            <Key size={18} className="text-primary" />
                          </InputGroup.Text>
                          <Form.Control
                            type={showPass ? "text" : "password"}
                            placeholder="••••••••"
                            value={passInput}
                            onChange={(e) => setPassInput(e.target.value)}
                            className="border-start-0 py-2"
                            autoFocus
                          />
                          <Button 
                            variant="white" 
                            className="border border-start-0 py-0" 
                            onClick={() => setShowPass(!showPass)}
                          >
                            {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                          </Button>
                        </InputGroup>
                        {loginError && <div className="text-danger small mt-2 fw-bold text-center">Password tidak valid!</div>}
                      </Form.Group>
                      
                      <Button variant="primary" type="submit" className="w-100 py-2 fw-bold shadow-sm d-flex align-items-center justify-content-center gap-2 mb-3">
                         Selanjutnya <ArrowRight size={18} />
                      </Button>
                      
                      <div className="text-center">
                        <hr className="my-3 opacity-10" />
                        <p className="small text-muted mb-2">Butuh bantuan?</p>
                        <Button variant="outline-dark" size="sm" className="w-100 fw-bold d-flex align-items-center justify-content-center gap-2" onClick={handleRequestKey}>
                          <Mail size={16} /> Hubungi Team Billing
                        </Button>
                      </div>
                    </Form>
                  ) : (
                    <div>
                      <div className="mb-4 text-center">
                        <div className="d-flex justify-content-center mb-3">
                          <Badge bg="info" className="p-2 px-3 rounded-pill bg-opacity-10 text-info border border-info border-opacity-25">
                            <Smartphone size={14} className="me-1" /> Scan barcode cukup 1x saja saat setup
                          </Badge>
                        </div>
                        <p className="small text-muted mb-3">Masukkan 6 digit kode dari aplikasi <strong>Google Authenticator</strong> yang sudah terdaftar di HP Anda.</p>
                        
                        <Button 
                          variant="link" 
                          size="sm" 
                          className="text-decoration-none text-primary fw-bold p-0 mb-3 small"
                          style={{ fontSize: '12px' }}
                          onClick={() => setShowQR(!showQR)}
                        >
                          {showQR ? 'Sembunyikan Instruksi Setup' : 'Bantuan / Setup Awal (Scan QR)'}
                        </Button>
                        
                        {showQR && (
                          <motion.div 
                            initial={{ opacity: 0, y: -10 }} 
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white p-3 rounded border shadow-sm mb-3 d-inline-block mx-auto text-center"
                          >
                            <div className="small fw-bold mb-2">Setup Sekali Saja:</div>
                            <QRCodeCanvas value={qrValue} size={140} level="H" />
                            <div className="mt-2" style={{fontSize: '10px'}}>
                              <p className="mb-1 text-muted">Scan menggunakan Google Authenticator</p>
                              <code className="text-dark bg-light px-2 py-1 rounded">{TOTP_SECRET}</code>
                            </div>
                          </motion.div>
                        )}
                      </div>
                      
                      <Form onSubmit={handleGoogleVerify}>
                        <Form.Group className="mb-3 text-center">
                          <Form.Control
                            type="text"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            placeholder="0 0 0 0 0 0"
                            value={totpCode}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                              setTotpCode(val);
                            }}
                            className={`text-center fw-bold fs-3 border-2 py-3 shadow-sm transition-all ${totpError ? 'shake-animation border-danger' : 'border-primary'}`}
                            style={{ letterSpacing: '8px' }}
                            autoFocus
                          />
                          {totpError && <div className="text-danger small mt-2 fw-bold">Kode tidak valid atau sudah kadaluarsa!</div>}
                        </Form.Group>

                        <Button 
                          variant="primary" 
                          type="submit" 
                          className="w-100 py-3 fw-bold shadow-sm d-flex align-items-center justify-content-center gap-2 mb-3"
                          disabled={totpCode.length < 6}
                        >
                          <ShieldCheck size={20} /> Verifikasi & Masuk
                        </Button>
                      </Form>
                      
                      <div className="text-center">
                        <Button 
                          variant="link" 
                          size="sm" 
                          className="text-muted" 
                          onClick={() => {
                            setAuthStep(1);
                            setPassInput('');
                            setTotpCode('');
                            sessionStorage.removeItem('billing_auth');
                          }}
                        >
                           <ArrowLeft size={14} /> Kembali ke Langkah 1
                        </Button>
                      </div>
                    </div>
                  )}
                </Card.Body>
                <div className="bg-light p-3 text-center border-top">
                  <p className="mb-0 text-muted" style={{ fontSize: '10px' }}>&copy; {new Date().getFullYear()} 2FA Security System IT PGAS Solution</p>
                </div>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Navbar */}
      <nav className="navbar navbar-expand-lg navbar-dark bg-dark py-3 mb-4 no-print shadow-sm border-bottom border-primary border-3">
        <Container>
          <span className="navbar-brand d-flex align-items-center gap-3 font-weight-bold">
            <div className="bg-primary p-2 rounded shadow-sm">
              <FileText size={22} className="text-white" />
            </div>
            <div className="d-flex flex-column">
              <span className="fs-5 lh-1">Generator Nota Pajak</span>
              <span className="small opacity-50 fw-normal">PT PGAS Solution</span>
            </div>
          </span>
          <div className="ms-auto d-flex gap-3 align-items-center">
            <Button 
              variant={activeTab === 'history' ? "primary" : "outline-light"} 
              size="sm" 
              onClick={() => setActiveTab(activeTab === 'generator' ? 'history' : 'generator')}
              className="d-flex align-items-center gap-2 px-3 fw-bold"
            >
              {activeTab === 'generator' ? <History size={16} /> : <FileText size={16} />}
              {activeTab === 'generator' ? 'Riwayat Data' : 'Kembali Ke Generator'}
            </Button>
            {activeTab === 'generator' && (
              <div className="d-flex gap-2">
                <Button variant="outline-info" size="sm" onClick={handleDownloadPDF} className="fw-bold d-flex align-items-center gap-2">
                  <Download size={16} /> PDF
                </Button>
                <Button variant="warning" size="sm" onClick={handlePrint} className="fw-bold d-flex align-items-center gap-2 text-dark">
                  <Printer size={16} /> Print
                </Button>
              </div>
            )}
          </div>
        </Container>
      </nav>

      <Container fluid="lg">
        <Tabs
          activeKey={activeTab}
          onSelect={(k) => setActiveTab(k || 'generator')}
          className="mb-4 no-print custom-tabs"
          fill
        >
          <Tab eventKey="generator" title="Input & Preview">
            <Row className="g-4">
              {/* Form Side */}
              <Col xl={6} className="no-print">
                <AnimatePresence>
                  {uploadSuccess && (
                    <motion.div
                      initial={{ opacity: 0, y: -20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="mb-3"
                    >
                      <Alert variant="success" className="d-flex align-items-center gap-3 border-0 shadow-sm py-3">
                        <div className="bg-success text-white rounded-circle p-2 d-flex align-items-center justify-content-center">
                          <CheckCircle2 size={20} />
                        </div>
                        <div>
                          <h6 className="mb-0 fw-bold">Faktur Pajak Berhasil Diunggah!</h6>
                          <p className="mb-0 small opacity-75">Data telah diekstrak secara otomatis ke formulir di bawah.</p>
                        </div>
                      </Alert>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="d-flex flex-column mb-4">
                  <div className="d-flex justify-content-between align-items-start border-bottom pb-3 mb-2">
                    <div>
                      <div className="d-flex align-items-center gap-2 mb-1">
                        <h4 className="mb-0 fw-bold text-dark">{editingId ? 'Edit Nota Pembatalan' : 'Editor Nota'}</h4>
                        {editingId && (
                          <div className="bg-info-subtle text-info px-2 py-1 rounded small fw-bold border border-info-subtle">
                            Mode Edit
                          </div>
                        )}
                      </div>
                      {editingId ? (
                        <p className="text-primary mb-0 fw-bold font-monospace small">
                          <FileCheck2 size={14} className="me-1" /> {data.nomor}
                        </p>
                      ) : (
                        <p className="text-muted mb-0 small">Masukkan data nota secara manual atau unggah faktur pajak.</p>
                      )}
                    </div>
                    
                    <div className="d-flex flex-column align-items-end gap-2">
                      <div className="d-flex gap-2">
                        {editingId && (
                          <Button 
                            variant="outline-secondary" 
                            size="sm" 
                            className="fw-bold"
                            onClick={() => { setEditingId(null); setData(initialData); }}
                          >
                            Batal Edit
                          </Button>
                        )}
                        <Button 
                          variant={saveSuccess ? "success" : editingId ? "info" : "primary"} 
                          onClick={handleSaveToDb} 
                          disabled={isSaving}
                          className="d-flex align-items-center gap-2 shadow-sm px-3"
                        >
                          {isSaving ? <Spinner animation="border" size="sm" /> : saveSuccess ? <CheckCircle2 size={18} /> : editingId ? <Save size={18} /> : <Plus size={18} />}
                          {isSaving ? 'Menyimpan...' : saveSuccess ? 'Berhasil' : editingId ? 'Update Data' : 'Simpan Data'}
                        </Button>
                      </div>
                      {saveError && (
                        <div className="text-danger small fw-bold" style={{ maxWidth: '200px', textAlign: 'right' }}>
                          Error: {saveError}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
            <Card className="mb-4 border-0 shadow-sm overflow-hidden">
              <div className="bg-primary p-3 d-flex align-items-center gap-2 text-white">
                <Upload size={18} />
                <h6 className="mb-0 fw-bold">Unggah Faktur Pajak</h6>
              </div>
              <Card.Body className="bg-light-subtle">
                <div className="d-flex flex-column align-items-center">
                  <Form.Group className="w-100">
                    <div className="custom-file-upload border-2 border-dashed rounded p-4 text-center bg-white">
                      <Form.Control 
                        type="file" 
                        accept="image/*,application/pdf"
                        onChange={handleFileUpload}
                        disabled={isExtracting}
                        className="d-none"
                        id="actual-file-input"
                      />
                      <label htmlFor="actual-file-input" className="cursor-pointer mb-0 w-100">
                        {isExtracting ? (
                          <div className="d-flex flex-column align-items-center gap-2 py-2">
                            <Spinner animation="border" size="sm" variant="primary" />
                            <span className="small text-primary fw-bold">Sedang Menganalisis Dokumen...</span>
                          </div>
                        ) : (
                          <div className="d-flex flex-column align-items-center gap-1 py-1">
                            <Upload className="text-primary mb-2" size={32} />
                            <span className="fw-bold text-dark">Klik untuk Unggah Gambar</span>
                            <span className="text-muted small">AI akan mengisi form otomatis dari Faktur Pajak Anda</span>
                          </div>
                        )}
                      </label>
                    </div>
                  </Form.Group>
                  {uploadError && (
                    <Alert variant="danger" className="mt-3 py-2 px-3 small d-flex align-items-center gap-2 border-0 shadow-sm w-100">
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
                    <Form.Label className="small fw-bold">Kota Penandatangan</Form.Label>
                    <Form.Control 
                      type="text" 
                      value={data.kotaDokumen}
                      onChange={(e) => setData({...data, kotaDokumen: e.target.value})}
                      placeholder="Contoh: Jakarta"
                    />
                  </Col>
                  <Col md={6}>
                    <Form.Label className="small fw-bold">Tanggal Nota</Form.Label>
                    <Form.Control 
                      type="date" 
                      value={data.tanggalDokumen}
                      onChange={(e) => setData({...data, tanggalDokumen: e.target.value})}
                    />
                  </Col>
                  <Col md={12}>
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

                  <div className="mt-4 d-flex flex-column align-items-end">
                    <div className="text-center" style={{ minWidth: '250px' }}>
                      <p className="mb-1">{data.kotaDokumen}, {formatDateIndo(data.tanggalDokumen)}</p>
                      <p className="fw-bold mb-0">{data.penandatangan}</p>
                      <div style={{ height: '70px' }}></div>
                    </div>
                  </div>
                </div>
              </Col>
            </Row>
          </Tab>
          <Tab eventKey="history" title="History Data">
             <Card className="shadow-sm border-0">
                <Card.Header className="bg-dark text-white p-3">
                  <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
                    <h5 className="mb-0 fw-bold d-flex align-items-center gap-2">
                       <History size={20} className="text-primary" />
                       Riwayat Nota Pembatalan
                    </h5>
                    
                    <Form onSubmit={handleSearch} className="d-flex gap-2">
                      <InputGroup size="sm">
                        <Form.Control 
                          placeholder="Cari nomor nota/faktur..." 
                          value={searchInput}
                          onChange={(e) => setSearchInput(e.target.value)}
                          className="border-secondary"
                        />
                        <Button variant="primary" type="submit">
                          <Search size={16} />
                        </Button>
                      </InputGroup>
                      <Button 
                        variant="outline-light" 
                        size="sm" 
                        onClick={() => {
                          setSearchInput('');
                          setSearchQuery('');
                          setCurrentPage(1);
                        }}
                        title="Clear Search"
                      >
                        <RefreshCw size={16} />
                      </Button>
                    </Form>
                  </div>
                </Card.Header>
                <Card.Body className="p-0">
                  {historyError && (
                    <Alert variant="danger" className="m-3 d-flex align-items-center gap-2 border-0 shadow-sm">
                      <AlertCircle size={20} />
                      <div>
                        <h6 className="mb-0 fw-bold">Gagal Mengambil Data</h6>
                        <p className="mb-0 small opacity-75">{historyError}</p>
                      </div>
                      <Button variant="outline-danger" size="sm" className="ms-auto" onClick={() => fetchHistory(currentPage, searchQuery)}>
                        Coba Lagi
                      </Button>
                    </Alert>
                  )}
                  
                  {isLoadingHistory ? (
                    <div className="text-center py-5">
                      <Spinner animation="border" variant="primary" />
                      <p className="mt-2 text-muted">Memuat data history...</p>
                    </div>
                  ) : history.length === 0 ? (
                    <div className="text-center py-5">
                      <div className="bg-light rounded-circle d-inline-flex p-4 mb-3">
                        <History size={48} className="text-muted" />
                      </div>
                      <p className="text-muted fw-bold">Belum ada history data.</p>
                      {searchQuery && (
                        <Button variant="link" onClick={() => { setSearchInput(''); setSearchQuery(''); }}>
                          Hapus Filter Pencarian
                        </Button>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="table-responsive">
                        <Table hover className="align-middle mb-0 custom-history-table">
                          <thead className="bg-light">
                            <tr>
                              <th className="px-4 py-3">Nomor Nota</th>
                              <th className="py-3">Faktur Pajak</th>
                              <th className="py-3">Penerima</th>
                              <th className="py-3">Tanggal Buat</th>
                              <th className="text-center py-3">Aksi</th>
                            </tr>
                          </thead>
                          <tbody>
                            {history.map((item) => (
                              <tr key={item.id}>
                                <td className="px-4 py-3">
                                  <div className="fw-bold text-primary mb-0 d-flex align-items-center gap-2">
                                    <FileText size={16} className="opacity-50" />
                                    <span className="text-truncate" style={{maxWidth: '220px'}} title={item.nomor}>{item.nomor}</span>
                                  </div>
                                </td>
                                <td>
                                  <div className="small fw-bold text-dark">{item.faktur_nomor}</div>
                                  <div className="small text-muted">{formatDateIndo(item.faktur_tanggal)}</div>
                                </td>
                                <td>
                                  <Badge bg="light" text="dark" className="border shadow-sm fw-normal px-2 py-1">
                                    {item.penerima_name}
                                  </Badge>
                                </td>
                                <td className="small text-muted">
                                  {new Date(item.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </td>
                                <td className="text-center">
                                  <div className="d-flex justify-content-center gap-2">
                                    <Button 
                                      variant="outline-primary" 
                                      size="sm" 
                                      onClick={() => loadFromHistory(item)} 
                                      className="fw-bold d-flex align-items-center gap-1 px-3 shadow-sm border-2 rounded-pill"
                                    >
                                      <Save size={14} /> Buka
                                    </Button>
                                    <Button 
                                      variant="outline-danger" 
                                      size="sm" 
                                      onClick={() => handleDelete(item.id)} 
                                      className="d-flex align-items-center justify-content-center p-2 rounded-circle border-danger text-danger hover-bg-danger transition-all shadow-sm"
                                      title="Hapus"
                                    >
                                      <Trash2 size={16} />
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </Table>
                      </div>
                      
                      {/* Pagination UI */}
                      {totalPages > 1 && (
                        <div className="d-flex justify-content-between align-items-center p-3 border-top bg-light">
                          <div className="small text-muted">
                            Halaman <strong>{currentPage}</strong> dari <strong>{totalPages}</strong>
                          </div>
                          <div className="d-flex gap-2">
                            <Button 
                              variant="outline-secondary" 
                              size="sm" 
                              disabled={currentPage === 1}
                              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                              className="d-flex align-items-center gap-1 shadow-sm"
                            >
                              <ChevronLeft size={16} /> Prev
                            </Button>
                            <div className="d-none d-md-flex gap-1">
                              {[...Array(totalPages)].map((_, i) => {
                                const pageNum = i + 1;
                                // Simple logic to show current, first, last and 2 neighbors
                                if (
                                  pageNum === 1 || 
                                  pageNum === totalPages || 
                                  (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                                ) {
                                  return (
                                    <Button
                                      key={pageNum}
                                      variant={currentPage === pageNum ? "primary" : "outline-secondary"}
                                      size="sm"
                                      onClick={() => setCurrentPage(pageNum)}
                                      className="shadow-sm"
                                    >
                                      {pageNum}
                                    </Button>
                                  );
                                } else if (
                                  (pageNum === currentPage - 2) || 
                                  (pageNum === currentPage + 2)
                                ) {
                                  return <span key={pageNum} className="px-1">...</span>;
                                }
                                return null;
                              })}
                            </div>
                            <Button 
                              variant="outline-secondary" 
                              size="sm" 
                              disabled={currentPage === totalPages}
                              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                              className="d-flex align-items-center gap-1 shadow-sm"
                            >
                              Next <ChevronRight size={16} />
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </Card.Body>
             </Card>
          </Tab>
        </Tabs>
      </Container>

      <footer className="mt-5 py-4 border-top text-center no-print text-muted small">
        <Container>
           &copy; {new Date().getFullYear()} Nota Pembatalan Generator &bull; IT PT PGAS Solution
        </Container>
      </footer>
    </div>
  );
}
