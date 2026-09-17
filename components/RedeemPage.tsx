import React, { useState, useEffect, useRef } from 'react';
import type { Prize } from '../types';
import { CheckCircleIcon, XCircleIcon, SpinnerIcon, CameraIcon } from './Icons';

interface RedeemPageProps {
  onRedeem: (code: string) => Promise<{ success: boolean; message: string; prize?: Prize }>;
}

const RedeemPage: React.FC<RedeemPageProps> = ({ onRedeem }) => {
  // Leer código de la URL al cargar el componente
  const getCodeFromUrl = () => {
    const searchParams = new URLSearchParams(window.location.search);
    return searchParams.get('code') ?? '';
  };

  const [code, setCode] = useState(getCodeFromUrl());
  const [result, setResult] = useState<{ success: boolean; message: string; prize?: Prize } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<any | null>(null); // Use 'any' for dynamically loaded class instance
  const readerId = "qr-reader";

  // Auto-intentar canjear si hay código en la URL al cargar
  useEffect(() => {
    const urlCode = getCodeFromUrl();
    if (urlCode) {
      // Intentar canjear automáticamente el código de la URL
      const autoRedeem = async () => {
        setIsLoading(true);
        setResult(null);
        try {
          const redemptionResult = await onRedeem(urlCode);
          setResult(redemptionResult);
        } catch (error) {
          setResult({ success: false, message: 'Ocurrió un error al canjear.'});
        } finally {
          setIsLoading(false);
        }
      };
      autoRedeem();
    }
  }, []); // Solo ejecutar al montar el componente

  const startScanner = async () => {
    if (scannerRef.current) return;

    try {
        const { Html5Qrcode } = await import('html5-qrcode');
        const qrScanner = new Html5Qrcode(readerId);
        scannerRef.current = qrScanner;
        setIsScanning(true);
        setResult(null);

        await qrScanner.start(
            { facingMode: "environment" },
            {
                fps: 10,
                qrbox: { width: 250, height: 250 },
            },
            (decodedText: string) => {
                setCode(decodedText);
                stopScanner();
            },
            (errorMessage: string) => {
                // handle scan error, usually ignored
            }
        );
    } catch (err) {
        console.error("Error starting QR scanner:", err);
        setResult({ success: false, message: "No se pudo iniciar la cámara." });
        setIsScanning(false);
    }
  };

  const stopScanner = () => {
    if (scannerRef.current && isScanning) {
        scannerRef.current.stop()
            .then(() => {
                scannerRef.current = null;
                setIsScanning(false);
            })
            .catch((err: any) => console.error("Error stopping scanner", err));
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const presetCode = params.get('code');
    if (presetCode) {
      setCode(presetCode);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        stopScanner();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isScanning]);


  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code) return;

    setIsLoading(true);
    setResult(null);

    try {
      const redemptionResult = await onRedeem(code);
      setResult(redemptionResult);
    } catch (error) {
       setResult({ success: false, message: 'Ocurrió un error al canjear.'});
    } finally {
        setCode('');
        setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto text-center text-[#173B3D]">
      <p className="font-display text-sm font-extrabold uppercase tracking-[.2em] text-[#F15B43]">Herramienta de sucursal</p>
      <h2 className="mt-2 font-display text-5xl font-extrabold text-[#0B4F56]">CANJEAR PREMIO</h2>
      <p className="mb-8 mt-3 text-[#587776]">Escanea el QR o ingresa el código para validarlo.</p>

      <div className="rounded-2xl border border-[#DCE8E5] bg-[#FFFDF8] p-6 shadow-[0_14px_32px_rgba(7,56,61,.16)] sm:p-8">

        {isScanning ? (
            <div>
                 <div id={readerId} className="w-full rounded-xl overflow-hidden border-2 border-[#F15B43]"></div>
                 <button onClick={stopScanner} className="mt-4 rounded-xl bg-[#587776] px-4 py-2 font-bold text-white">
                    Cancelar
                 </button>
            </div>
        ) : (
            <button onClick={startScanner} className="mb-6 flex min-h-12 w-full items-center justify-center gap-3 rounded-xl bg-[#0B4F56] px-6 py-3 font-bold text-white hover:bg-[#07383D]">
                <CameraIcon className="h-6 w-6" />
                Escanear QR
            </button>
        )}

        <form onSubmit={handleRedeem} className="flex flex-col sm:flex-row gap-4 mt-4">
          <input
            type="text"
            value={code}
            onChange={(e) => {
                setCode(e.target.value);
                setResult(null);
            }}
            placeholder="Introduce el código del premio"
            aria-label="Código del premio"
            className="min-h-12 flex-grow rounded-xl border border-[#9EB7B4] bg-white px-4 py-3 text-[#173B3D] placeholder-[#6E8C8B] focus:outline-none focus:ring-4 focus:ring-[#0B4F56]/25"
          />
          <button
            type="submit"
            disabled={isLoading || !code}
            className="flex min-h-12 items-center justify-center rounded-xl bg-[#F15B43] px-6 py-3 font-bold text-white hover:bg-[#E44E39] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? <SpinnerIcon className="h-6 w-6" /> : 'Validar'}
          </button>
        </form>

        {result && (
          <div role="status" className={`mt-8 rounded-xl border-2 p-6 ${result.success ? 'bg-emerald-50 border-emerald-500' : 'bg-red-50 border-red-400'}`}>
            <div className="flex items-center justify-center space-x-4">
              {result.success ? <CheckCircleIcon className="h-12 w-12 text-green-400" /> : <XCircleIcon className="h-12 w-12 text-red-400" />}
              <div>
                <p className={`text-xl font-bold ${result.success ? 'text-emerald-800' : 'text-red-800'}`}>
                  {result.message}
                </p>
                {result.prize && (
                   <p className="text-lg font-semibold text-[#173B3D]">{result.prize.icon} {result.prize.name}</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RedeemPage;
