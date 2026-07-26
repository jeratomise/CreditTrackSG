
import React, { useState, useRef } from 'react';
import { extractBillData } from '../services/geminiService';
import { dbService } from '../services/dbService';
import { Bill } from '../types';
import { Loader2, Upload, AlertCircle, FileText, CheckCircle, Camera } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface BillUploaderProps {
  onBillProcessed: (bills: Bill[]) => void;
}

const UPLOAD_TIMEOUT_MS = 120000;
const MAX_FILE_BYTES = 10 * 1024 * 1024;

export const BillUploader: React.FC<BillUploaderProps> = ({ onBillProcessed }) => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Helper to prevent infinite hanging - Increased to 120s for larger/complex PDF files
  const uploadWithTimeout = async (promise: Promise<any>, ms: number = UPLOAD_TIMEOUT_MS) => {
    let timeoutId: ReturnType<typeof setTimeout>;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error("Upload timed out (120s). The file is large or AI processing is taking longer than expected.")), ms);
    });
    return Promise.race([
      promise,
      timeoutPromise
    ]).then((res) => {
      clearTimeout(timeoutId);
      return res;
    });
  };

  const processFile = async (file: File): Promise<Bill[]> => {
     if (!user) throw new Error("User not authenticated");

     if (file.size > MAX_FILE_BYTES) {
         throw new Error(`File ${file.name} exceeds 10MB limit.`);
     }

     try {
        // 1. Upload to Supabase Storage FIRST. The backend reads the file from
        //    storage to run AI extraction server-side, so the Gemini API key is
        //    never exposed to the browser and large files don't hit request limits.
        let uploadedFilePath: string;
        try {
            uploadedFilePath = (await uploadWithTimeout(dbService.uploadBillDocument(file, user.id))) as string;
        } catch (uploadErr: any) {
            throw new Error(`Could not upload ${file.name}: ${uploadErr?.message || "Unknown error"}. Please try again.`);
        }

        // 2. Server-side AI extraction (authenticated; reads the uploaded file).
        let extractedData: Awaited<ReturnType<typeof extractBillData>>;
        try {
            extractedData = await uploadWithTimeout(extractBillData(uploadedFilePath));
        } catch (aiErr: any) {
            console.error("AI Error:", aiErr);
            throw new Error(`AI Analysis failed: ${aiErr?.message || "Unknown error"}`);
        }

        if (!extractedData.bills || extractedData.bills.length === 0) {
            throw new Error(`No bill details found in ${file.name}. Ensure text is legible.`);
        }

        const createdBills: Bill[] = [];

        // 3. Save Bills to DB (using the single uploaded file path)
        for (const billData of extractedData.bills) {
            const tempBill: Bill = {
                id: 'temp', // DB assigns ID
                bankName: billData.bankName || "Unknown Bank",
                cardName: billData.cardName || "Unknown Card",
                statementDate: billData.statementDate || new Date().toISOString().split('T')[0],
                dueDate: billData.dueDate || new Date().toISOString().split('T')[0],
                totalAmount: billData.totalAmount,
                isPaid: false,
                uploadedAt: new Date().toISOString(),
                riskScore: 0,
                transactions: (billData.transactions || []).map((t) => ({
                    id: 'temp',
                    date: t.date,
                    description: t.description,
                    amount: t.amount,
                    category: t.category,
                    suggestedCard: "Analyzing...",
                }))
            };

            try {
                const savedBill = await dbService.createBill(tempBill, user.id, uploadedFilePath);
                createdBills.push(savedBill);
            } catch (dbErr: any) {
                console.error("DB Save Error:", dbErr);
                throw new Error(`Database save failed: ${dbErr.message}`);
            }
        }

        return createdBills;
     } catch (err: any) {
        throw new Error(`Failed to parse ${file.name}: ${err.message || "Unknown error"}`);
     }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsLoading(true);
    setErrors([]);
    setUploadStatus(`Preparing to process ${files.length} file(s)...`);

    const allNewBills: Bill[] = [];
    const newErrors: string[] = [];
    const fileArray: File[] = Array.from(files);

    try {
        // Run all file processes in parallel
        const results = await Promise.allSettled(fileArray.map(file => processFile(file)));

        results.forEach((result) => {
            if (result.status === 'fulfilled') {
                allNewBills.push(...result.value);
            } else {
                newErrors.push((result.reason as any)?.message || "Unknown error occurred");
            }
        });

        if (allNewBills.length > 0) {
            onBillProcessed(allNewBills);
            setUploadStatus(`Added ${allNewBills.length} bill(s) from ${fileArray.length - newErrors.length} file(s).`);
        } else {
            setUploadStatus(null);
        }

        if (newErrors.length > 0) {
            setErrors(newErrors);
        }
    } catch (err) {
        setErrors(["An unexpected error occurred during processing."]);
    } finally {
        setIsLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const openFilePicker = () => {
    if (!isLoading) fileInputRef.current?.click();
  };

  return (
    <div className="bg-marine-900 border border-brass-500/15 p-5 sm:p-6">
      <h2 className="text-base font-medium text-ink mb-4 flex items-center gap-2.5">
        <Upload className="w-4 h-4 text-brass-400" strokeWidth={1.5} />
        Upload bills
      </h2>

      <div
        role="button"
        tabIndex={isLoading ? -1 : 0}
        aria-label="Choose a PDF or image to upload"
        className={`border border-dashed p-8 sm:p-12 text-center transition-colors duration-150 ${
          isLoading
            ? 'border-brass-500 bg-marine-800 cursor-wait'
            : 'border-brass-500/40 hover:border-brass-500 hover:bg-marine-800 cursor-pointer'
        }`}
        onClick={openFilePicker}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openFilePicker();
          }
        }}
      >
        {isLoading ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-6 h-6 text-brass-400 animate-spin" strokeWidth={1.5} />
            <p className="text-sm text-ink-soft">
                {uploadStatus || "Reading your statement…"}
            </p>
            <p className="text-xs text-ink-mute">This can take up to two minutes for a large PDF.</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <FileText className="w-8 h-8 text-brass-500/60" strokeWidth={1.5} />
            <p className="text-sm text-ink-soft">Tap to choose a PDF or image</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">PDF · JPG · PNG · max 10MB</p>
          </div>
        )}
        <input
          type="file"
          multiple
          ref={fileInputRef}
          onChange={handleFileUpload}
          className="hidden"
          accept="image/*,.pdf"
        />
        {/* Camera input — opens rear camera on mobile */}
        <input
          type="file"
          ref={cameraInputRef}
          onChange={handleFileUpload}
          className="hidden"
          accept="image/*"
          capture="environment"
        />
      </div>

      {/* Camera Button — mobile only */}
      {!isLoading && (
        <button
          onClick={() => cameraInputRef.current?.click()}
          className="sm:hidden w-full mt-3 flex items-center justify-center gap-2 py-3 bg-brass-500 text-marine-900 font-medium text-sm hover:bg-brass-400 transition-colors duration-150 min-h-[48px]"
        >
          <Camera className="w-5 h-5" strokeWidth={1.5} />
          Take a photo
        </button>
      )}

      {!isLoading && uploadStatus && (
          <div className="mt-4 p-3 bg-marine-800 border border-brass-500/30 text-brass-300 text-sm flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0" strokeWidth={1.5} />
            {uploadStatus}
          </div>
      )}

      {errors.length > 0 && (
        <div className="mt-4 p-3 bg-marine-800 border border-danger/40 text-danger text-sm">
            <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                Could not process:
            </div>
            <ul className="space-y-1 pl-6 list-disc">
                {errors.map((err, i) => (
                    <li key={i} className="text-xs">{err}</li>
                ))}
            </ul>
        </div>
      )}
    </div>
  );
};
