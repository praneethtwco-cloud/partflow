import Papa from 'papaparse';
import JSZip from 'jszip';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export function jsonToCsv(data: any[]): string {
  return Papa.unparse(data);
}

export async function downloadCsv(csv: string, filename: string): Promise<void> {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const isNative = Capacitor.isNativePlatform();

  if (isNative) {
    // Use Filesystem and Share on native platforms
    const base64 = await blobToBase64(blob);
    const savedFile = await Filesystem.writeFile({
      path: filename,
      data: base64,
      directory: Directory.Cache
    });

    await Share.share({
      title: `Export ${filename}`,
      text: `PartFlow ${filename} export`,
      url: savedFile.uri,
      dialogTitle: 'Save or Share'
    });
  } else {
    // Standard Web Download
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, _) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64data = reader.result as string;
      resolve(base64data.split(',')[1]);
    };
    reader.readAsDataURL(blob);
  });
}

export function downloadCsvWithHeaders(data: any[], filename: string, headers: string[]) {
  if (data.length === 0) {
    downloadCsv('', filename);
    return;
  }
  
  const filteredData = data.map(row => {
    const filteredRow: Record<string, any> = {};
    headers.forEach(header => {
      filteredRow[header] = row[header] ?? '';
    });
    return filteredRow;
  });
  
  const csv = Papa.unparse(filteredData, { columns: headers });
  downloadCsv(csv, filename);
}

export async function downloadZipWithFiles(files: { name: string; content: string }[], zipFilename: string): Promise<void> {
  const zip = new JSZip();
  
  files.forEach(file => {
    zip.file(file.name, file.content);
  });
  
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const isNative = Capacitor.isNativePlatform();

  if (isNative) {
    const base64 = await blobToBase64(zipBlob);
    const savedFile = await Filesystem.writeFile({
      path: zipFilename,
      data: base64,
      directory: Directory.Cache
    });

    await Share.share({
      title: `Export ${zipFilename}`,
      text: 'PartFlow backup export',
      url: savedFile.uri,
      dialogTitle: 'Save or Share'
    });
  } else {
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(zipBlob);
      link.setAttribute('href', url);
      link.setAttribute('download', zipFilename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }
}

export function parseCsv(file: File): Promise<any[]> {
    return new Promise((resolve, reject) => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                resolve(results.data);
            },
            error: (error) => {
                reject(error);
            }
        });
    });
}
