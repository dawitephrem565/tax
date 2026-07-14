'use client';

import React from "react"

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { X, Upload } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface NewReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
}

const reportTypes = [
  'VAT',
  'Withholding Tax',
  'Pension',
  'Income Tax',
  'Sold Receipt',
  'Withhold Receipt',
];

interface FileUpload {
  name: string;
  file: File | null;
}

export default function NewReportModal({
  isOpen,
  onClose,
  onSubmit,
}: NewReportModalProps) {
  const [reportType, setReportType] = useState('');
  const [files, setFiles] = useState<FileUpload[]>([
    { name: 'VAT Document', file: null },
    { name: 'Withholding Document', file: null },
    { name: 'Pension Document', file: null },
    { name: 'Income Tax Document', file: null },
    { name: 'Sold Receipt', file: null },
    { name: 'Withhold Receipt', file: null },
  ]);
  const [error, setError] = useState('');

  const handleFileUpload = (index: number, file: File | null) => {
    const newFiles = [...files];
    newFiles[index].file = file;
    setFiles(newFiles);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!reportType) {
      setError('Please select a report type');
      return;
    }

    const uploadedFiles = files.filter((f) => f.file !== null);
    if (uploadedFiles.length === 0) {
      setError('Please upload at least one document');
      return;
    }

    onSubmit({
      type: reportType,
      files: uploadedFiles,
    });

    setReportType('');
    setFiles(
      files.map((f) => ({
        ...f,
        file: null,
      }))
    );
  };

  const handleClose = () => {
    setReportType('');
    setError('');
    setFiles(
      files.map((f) => ({
        ...f,
        file: null,
      }))
    );
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-card border-b border-border flex items-center justify-between p-6">
          <h2 className="text-2xl font-bold text-foreground">Create New Report</h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-secondary rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Report Type Selection */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Report Type *
              </label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select report type..." />
                </SelectTrigger>
                <SelectContent>
                  {reportTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* File Uploads */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-4">
                Upload Documents
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {files.map((fileObj, index) => (
                  <div
                    key={index}
                    className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:bg-secondary transition-colors"
                  >
                    <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-3" />
                    <label className="block">
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={(e) =>
                          handleFileUpload(index, e.target.files?.[0] || null)
                        }
                        className="hidden"
                      />
                      <span className="text-sm font-medium text-foreground cursor-pointer hover:text-primary block truncate">
                        {fileObj.file ? fileObj.file.name : `${fileObj.name}`}
                      </span>
                    </label>
                    <p className="text-xs text-muted-foreground mt-2">
                      {fileObj.file ? 'PDF uploaded' : 'PDF only'}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 justify-end pt-6 border-t border-border">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
              >
                Cancel
              </Button>
              <Button type="submit">
                Submit Report
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
