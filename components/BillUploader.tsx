
import React, { useState, useRef } from 'react';
import { extractBillData } from '../services/geminiService';
import { dbService } from '../services/dbService';
import { Bill } from '../types';
import { Loader2, Upload, AlertCircle, FileText, CheckCircle, Camera } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface BillUploaderProps {
  onBillProcessed: (bills: Bill[]) => void;
}

export const BillUploader: React.FC<BillUploaderProps> = ({ onBillProcessed }) => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Helper to prevent infinite hanging - Increased to 120s for larger/complex PDF files
  const uploadWithTimeout = async (promise: Promise<any>, ms: number = 120000) => {
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

     // File Size Check (10MB Limit)
     if (file.size > 10 * 1024 * 1024) {
         throw new Error(`File ${file.name} exceeds 10MB limit.`);
     }

     return new Promise(async (resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = async () => {
            try {
                const base64String = (reader.result as string).split(',')[1];
                
                // Determine Mime Type robustly
                let mimeType = file.type;
                if (!mimeType || mimeType === '') {
                    if (file.name.toLowerCase().endsWith('.pdf')) mimeType = 'application/pdf';
                    else if (file.name.toLowerCase().endsWith('.jpg') || file.name.toLowerCase().endsWith('.jpeg')) mimeType = 'image/jpeg';
                    else if (file.name.toLowerCase().endsWith('.png')) mimeType = 'image/png';
                    else mimeType = 'application/pdf'; // Default fallback
                }

                // --- PARALLEL EXECUTION START ---
                // Start uploading to Storage and analyzing with AI at the same time
                const [uploadResult, aiResult] = await Promise.allSettled([
                    uploadWithTimeout(dbService.uploadBillDocument(file, user.id)),
                    extractBillData(base64String, mimeType)
                ]);

                // 1. Handle AI Result
                if (aiResult.status === 'rejected') {
                    console.error("AI Error:", aiResult.reason);
                    throw new Error(`AI Analysis failed: ${aiResult.reason?.message || "Unknown error"}`);
                }
                const extractedData = aiResult.value;
                
                if (!extractedData.bills || extractedData.bills.length === 0) {
                     throw new Error(`No bill details found in ${file.name}. Ensure text is legible.`);
                }

                // 2. Handle Upload Result
                let uploadedFilePath: string | undefined = undefined;
                if (uploadResult.status === 'fulfilled') {
                    uploadedFilePath = uploadResult.value as string;
                } else {
                    console.warn(`File upload failed for ${file.name}:`, uploadResult.reason);
                    // We allow the bill to be created even if the PDF upload failed, 
                    // but we might want to notify the user.
                }
                // --- PARALLEL EXECUTION END ---

                const createdBills: Bill[] = [];

                // 3. Save Bills to DB (Using the single uploaded file path)
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

                    // Pass the already uploaded path
                    try {
                        const savedBill = await dbService.createBill(tempBill, user.id, uploadedFilePath);
                        createdBills.push(savedBill);
                    } catch (dbErr: any) {
                        console.error("DB Save Error:", dbErr);
                        throw new Error(`Database save failed: ${dbErr.message}`);
                    }
                }

                resolve(createdBills);
            } catch (err: any) {
                reject(new Error(`Failed to parse ${file.name}: ${err.message || "Unknown error"}`));
            }
        };

        reader.onerror = () => reject(new Error(`Error reading file: ${file.name}`));
        reader.readAsDataURL(file);
     });
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

        results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                allNewBills.push(...result.value);
            } else {
                newErrors.push((result.reason as any)?.message || "Unknown error occurred");
            }
        });

        if (allNewBills.length > 0) {
            onBillProcessed(allNewBills);
            const successMsg = `Successfully processed ${allNewBills.length} bills from ${fileArray.length - newErrors.length} valid files.`;
            setUploadStatus(successMsg);
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

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
      <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <Upload className="w-5 h-5 text-primary" />
        Upload Bills
      </h2>
      
      <div 
        className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
          isLoading ? 'border-primary bg-indigo-50' : 'border-gray-300 hover:border-primary hover:bg-gray-50'
        }`}
        onClick={() => !isLoading && fileInputRef.current?.click()}
      >
        {isLoading ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-sm text-gray-600 font-medium">
                {uploadStatus || "AI is analyzing & saving to cloud..."}
            </p>
            <p className="text-xs text-gray-400">Please wait while we extract the data.</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 cursor-pointer">
            <div className="bg-indigo-100 p-4 rounded-full">
               <FileText className="w-8 h-8 text-primary" />
            </div>
            <p className="text-sm text-gray-600 font-medium">Click to upload PDF or Images</p>
            <p className="text-xs text-gray-400">Supports PDF, JPG, PNG (Max 10MB)</p>
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
          className="sm:hidden w-full mt-3 flex items-center justify-center gap-2 py-3 border-2 border-dashed border-indigo-300 rounded-xl text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors font-medium text-sm"
        >
          <Camera className="w-5 h-5" />
          Take Photo of Bill
        </button>
      )}

      {!isLoading && uploadStatus && (
          <div className="mt-4 p-3 bg-green-50 text-green-700 text-sm rounded-lg flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0" />
            {uploadStatus}
          </div>
      )}

      {errors.length > 0 && (
        <div className="mt-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg">
            <div className="flex items-center gap-2 font-medium mb-2">
                <AlertCircle className="w-4 h-4" />
                Errors encountered:
            </div>
            <ul className="list-disc list-inside space-y-1">
                {errors.map((err, i) => (
                    <li key={i} className="text-xs opacity-90">{err}</li>
                ))}
            </ul>
        </div>
      )}
    </div>
  );
};
