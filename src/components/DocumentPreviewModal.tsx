import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import mammoth from 'mammoth';
import DOMPurify from 'dompurify';
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Printer,
  Download,
  ExternalLink,
  SlidersHorizontal,
  FileText,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { OrderFile, PrintOrder, ShopSettings } from '../types/printdesk';
import { formatFileSize } from '../utils/formatters';
import { getCachedFileBlob, cacheFileBlob } from '../services/storageService';
import { fetchDriveFileBlob } from '../services/googleDrive';
import { ShopLogo } from './ShopLogo';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface DocumentPreviewModalProps {
  open: boolean;
  order: PrintOrder | null;
  settings: ShopSettings;
  initialFileIndex?: number;
  accessToken: string | null;
  onClose: () => void;
  onRequestGoogleAuth: () => void;
}

export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
  open,
  order,
  settings,
  initialFileIndex = 0,
  accessToken,
  onClose,
  onRequestGoogleAuth,
}) => {
  const [selectedIdx, setSelectedIdx] = useState(initialFileIndex);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showOverlay, setShowOverlay] = useState(true);

  const [fileBlob, setFileBlob] = useState<Blob | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [docxHtml, setDocxHtml] = useState<string | null>(null);

  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pdfPage, setPdfPage] = useState(1);
  const [pdfTotalPages, setPdfTotalPages] = useState(0);
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  useEffect(() => {
    setSelectedIdx(initialFileIndex);
  }, [initialFileIndex, order?.id, open]);

  const activeFile: OrderFile | undefined = order?.files?.[selectedIdx];

  const ext = (activeFile?.name.split('.').pop() || '').toLowerCase();
  const isPdf =
    activeFile?.mimeType === 'application/pdf' || ext === 'pdf';
  const isImage =
    activeFile?.mimeType?.startsWith('image/') ||
    ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext);
  const isDocx =
    activeFile?.mimeType ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    ext === 'docx';

  useEffect(() => {
    if (!open || !order || !activeFile) return;

    let cancelled = false;
    let localObjUrl: string | null = null;

    const loadFile = async () => {
      setLoading(true);
      setErrorMsg(null);
      setImageUrl(null);
      setDocxHtml(null);
      setPdfDoc(null);
      setPdfPage(1);
      setPdfTotalPages(0);
      setFileBlob(null);
      setZoom(1);
      setPan({ x: 0, y: 0 });

      try {
        let blob = await getCachedFileBlob(activeFile.id);

        if (!blob && activeFile.driveFileId) {
          if (!accessToken) {
            throw new Error('NEED_GOOGLE_AUTH');
          }
          blob = await fetchDriveFileBlob(accessToken, activeFile.driveFileId);
          await cacheFileBlob(activeFile.id, blob);
        }

        if (!blob) {
          throw new Error(
            'File belum tersedia di cache lokal maupun Google Drive.'
          );
        }

        if (cancelled) return;
        setFileBlob(blob);

        if (isPdf) {
          const buffer = await blob.arrayBuffer();
          const task = pdfjsLib.getDocument({ data: buffer });
          const doc = await task.promise;
          if (cancelled) return;
          setPdfDoc(doc);
          setPdfTotalPages(doc.numPages);
          setPdfPage(1);
        } else if (isImage) {
          localObjUrl = URL.createObjectURL(blob);
          setImageUrl(localObjUrl);
        } else if (isDocx) {
          const buffer = await blob.arrayBuffer();
          const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
          const clean = DOMPurify.sanitize(result.value, {
            USE_PROFILES: { html: true },
          });
          if (!cancelled) setDocxHtml(clean);
        }
      } catch (err: unknown) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        setErrorMsg(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadFile();

    return () => {
      cancelled = true;
      if (localObjUrl) URL.revokeObjectURL(localObjUrl);
    };
  }, [open, order, activeFile?.id, activeFile?.driveFileId, accessToken, isPdf, isImage, isDocx]);

  useEffect(() => {
    if (!pdfDoc || !pdfCanvasRef.current) return;
    let renderTask: pdfjsLib.RenderTask | null = null;
    let cancelled = false;

    const renderPage = async () => {
      try {
        const page = await pdfDoc.getPage(pdfPage);
        if (cancelled || !pdfCanvasRef.current) return;
        const viewport = page.getViewport({ scale: 1.4 * zoom });
        const canvas = pdfCanvasRef.current;
        const context = canvas.getContext('2d');
        if (!context) return;

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        renderTask = page.render({
          canvas,
          canvasContext: context,
          viewport,
        });
        await renderTask.promise;
      } catch {
        // Ignore cancelled render tasks
      }
    };

    renderPage();
    return () => {
      cancelled = true;
      if (renderTask) {
        renderTask.cancel();
      }
    };
  }, [pdfDoc, pdfPage, zoom]);

  if (!open || !order) return null;

  const handleDownload = () => {
    if (fileBlob && activeFile) {
      const url = URL.createObjectURL(fileBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = activeFile.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return;
    }
    if (activeFile?.webViewLink) {
      window.open(activeFile.webViewLink, '_blank', 'noopener,noreferrer');
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isImage) return;
    setDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    setPan({
      x: dragStartRef.current.panX + (e.clientX - dragStartRef.current.x),
      y: dragStartRef.current.panY + (e.clientY - dragStartRef.current.y),
    });
  };

  const handleMouseUp = () => setDragging(false);

  const drivePreviewIframeUrl = activeFile?.driveFileId
    ? `https://drive.google.com/file/d/${activeFile.driveFileId}/preview`
    : null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex flex-col"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-slate-900 text-white border-b border-slate-800 px-4 py-3 flex flex-wrap items-center justify-between gap-3 no-print">
        <div className="flex items-center gap-3 min-w-0">
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">
              {activeFile ? activeFile.name : 'Tidak ada file terlampir'}
            </div>
            <div className="text-xs text-slate-400 flex items-center gap-2 truncate">
              <span className="font-mono">{order.orderCode}</span>
              <span>·</span>
              <span>{order.clientName}</span>
              {activeFile && (
                <>
                  <span>·</span>
                  <span>{formatFileSize(activeFile.size)}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          {isPdf && pdfTotalPages > 0 && (
            <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1 border border-slate-700">
              <button
                type="button"
                onClick={() => setPdfPage((p) => Math.max(1, p - 1))}
                disabled={pdfPage <= 1}
                className="p-1.5 rounded hover:bg-slate-700 disabled:opacity-40"
                title="Halaman sebelumnya"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 text-xs font-mono tabular-nums">
                Hal {pdfPage} / {pdfTotalPages}
              </span>
              <button
                type="button"
                onClick={() => setPdfPage((p) => Math.min(pdfTotalPages, p + 1))}
                disabled={pdfPage >= pdfTotalPages}
                className="p-1.5 rounded hover:bg-slate-700 disabled:opacity-40"
                title="Halaman berikutnya"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {(isPdf || isImage) && (
            <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1 border border-slate-700">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.2).toFixed(2)))}
                className="p-1.5 rounded hover:bg-slate-700"
                title="Perkecil"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="px-2 text-xs font-mono tabular-nums">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(2.6, +(z + 0.2).toFixed(2)))}
                className="p-1.5 rounded hover:bg-slate-700"
                title="Perbesar"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setZoom(1);
                  setPan({ x: 0, y: 0 });
                }}
                className="p-1.5 rounded hover:bg-slate-700"
                title="Reset zoom & posisi"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowOverlay((s) => !s)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              showOverlay
                ? 'bg-orange-600 border-orange-500 text-white'
                : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Info Cetak
          </button>

          <button
            type="button"
            onClick={handleDownload}
            disabled={!fileBlob && !activeFile?.webViewLink}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-white disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" />
            Download
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-xs font-semibold text-white"
          >
            <Printer className="w-3.5 h-3.5" />
            Cetak
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800"
            aria-label="Tutup preview"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {order.files.length > 1 && (
        <div className="bg-slate-900/90 border-b border-slate-800 px-4 py-2 flex items-center gap-2 overflow-x-auto no-print">
          {order.files.map((f, idx) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setSelectedIdx(idx)}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                idx === selectedIdx
                  ? 'bg-orange-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              {f.name}
            </button>
          ))}
        </div>
      )}

      <div className="relative flex-1 overflow-auto flex items-center justify-center p-4 sm:p-8 bg-slate-950/90">
        {!activeFile ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center max-w-md text-slate-300">
            <FileText className="w-10 h-10 text-slate-500 mx-auto mb-3" />
            <p className="text-sm font-medium text-white mb-1">
              Belum ada file dokumen pada order ini
            </p>
            <p className="text-xs text-slate-400">
              Unggah file PDF, DOCX, atau gambar melalui menu Edit Order untuk melihat pratinjau cetak.
            </p>
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center gap-3 text-slate-300">
            <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            <span className="text-sm">Memuat pratinjau dokumen...</span>
          </div>
        ) : errorMsg === 'NEED_GOOGLE_AUTH' ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-lg w-full text-center space-y-4">
            <AlertCircle className="w-9 h-9 text-amber-400 mx-auto" />
            <h3 className="text-base font-semibold text-white">
              Izin Google Drive Diperlukan untuk Mengunduh Pratinjau
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              File ini tersimpan di Google Drive. Hubungkan ulang akun Google Anda agar PrintDesk dapat menampilkan pratinjau langsung, atau buka lewat iframe Google Drive.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={onRequestGoogleAuth}
                className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold"
              >
                Hubungkan Akun Google
              </button>
              {activeFile.webViewLink && (
                <a
                  href={activeFile.webViewLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Buka di Google Drive
                </a>
              )}
            </div>
          </div>
        ) : errorMsg && drivePreviewIframeUrl ? (
          <div className="w-full h-full max-w-4xl flex flex-col gap-2">
            <div className="text-xs text-amber-300 bg-amber-950/60 border border-amber-900 rounded-lg px-3 py-2 flex items-center justify-between">
              <span>Menampilkan fallback Google Drive Preview ({errorMsg})</span>
              {activeFile.webViewLink && (
                <a
                  href={activeFile.webViewLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-white"
                >
                  Buka tab baru
                </a>
              )}
            </div>
            <iframe
              src={drivePreviewIframeUrl}
              title={activeFile.name}
              className="w-full flex-1 rounded-xl bg-white border border-slate-800"
            />
          </div>
        ) : errorMsg ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
            <p className="text-sm font-medium text-white">Gagal Memuat Dokumen</p>
            <p className="text-xs text-slate-400">{errorMsg}</p>
          </div>
        ) : (
          <div
            id="printdesk-printable-area"
            className="flex items-center justify-center max-w-full"
          >
            {isPdf && (
              <div className="bg-white rounded-lg shadow-2xl overflow-auto max-w-full">
                <canvas ref={pdfCanvasRef} className="block mx-auto" />
              </div>
            )}

            {isImage && imageUrl && (
              <div
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                className={`overflow-hidden rounded-lg border border-slate-800 bg-slate-900/60 p-2 ${
                  dragging ? 'cursor-grabbing' : 'cursor-grab'
                }`}
              >
                <img
                  src={imageUrl}
                  alt={activeFile.name}
                  draggable={false}
                  style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    transition: dragging ? 'none' : 'transform 120ms ease-out',
                  }}
                  className="max-h-[78vh] w-auto object-contain select-none"
                />
              </div>
            )}

            {isDocx && docxHtml !== null && (
              <div className="bg-white text-slate-900 rounded-lg shadow-2xl max-w-3xl w-full p-8 sm:p-12 prose prose-slate prose-sm max-h-[80vh] overflow-y-auto">
                <div dangerouslySetInnerHTML={{ __html: docxHtml }} />
              </div>
            )}

            {!isPdf && !isImage && !isDocx && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 max-w-lg w-full text-center space-y-4">
                <FileText className="w-12 h-12 text-orange-500 mx-auto" />
                <div>
                  <h3 className="text-base font-semibold text-white">
                    Pratinjau Langsung Tidak Tersedia untuk Format .{ext.toUpperCase()}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    File desain mentah (seperti AI/PSD) dapat diunduh atau dibuka langsung melalui Google Drive.
                  </p>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold"
                  >
                    <Download className="w-4 h-4" />
                    Download File
                  </button>
                  {activeFile.webViewLink && (
                    <a
                      href={activeFile.webViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Buka di Drive
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {showOverlay && (
          <div className="fixed bottom-4 right-4 z-40 w-72 bg-slate-900/95 text-slate-100 border border-slate-700 rounded-xl p-4 shadow-2xl no-print">
            <div className="flex items-center justify-between gap-2 mb-2.5 pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2 min-w-0">
                <ShopLogo
                  logoDataUrl={settings.logoDataUrl}
                  shopName={settings.shopName}
                  size="xs"
                />
                <div className="min-w-0">
                  <span className="block text-[11px] font-semibold uppercase tracking-wider text-orange-400">
                    Spesifikasi Cetak
                  </span>
                  {settings.shopName.trim() && (
                    <span className="block text-[10px] text-slate-400 truncate">
                      {settings.shopName.trim()}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowOverlay(false)}
                className="text-slate-400 hover:text-white shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
              <dt className="text-slate-400">Ukuran</dt>
              <dd className="font-medium text-right">{order.specs.paperSize}</dd>
              <dt className="text-slate-400">Orientasi</dt>
              <dd className="font-medium text-right">{order.specs.orientation}</dd>
              <dt className="text-slate-400">Halaman</dt>
              <dd className="font-mono tabular-nums text-right">{order.specs.pageCount} hal</dd>
              <dt className="text-slate-400">Qty</dt>
              <dd className="font-mono tabular-nums text-right">
                {order.specs.copies} {order.specs.qtyUnit || 'PCS'}
              </dd>
              <dt className="text-slate-400">Bahan</dt>
              <dd className="font-medium text-right truncate" title={order.specs.paperMaterial}>
                {order.specs.paperMaterial}
              </dd>
              <dt className="text-slate-400">Warna</dt>
              <dd className="font-medium text-right">{order.specs.colorMode}</dd>
              <dt className="text-slate-400 col-span-2 pt-1 border-t border-slate-800">
                Finishing
              </dt>
              <dd className="col-span-2 font-medium text-slate-200">
                {order.specs.finishing || '-'}
              </dd>
            </dl>
          </div>
        )}
      </div>
    </div>
  );
};
