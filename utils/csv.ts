import Papa from 'papaparse';
import JSZip from 'jszip';

export function jsonToCsv(data: any[]): string {
  return Papa.unparse(data);
}

export function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
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

export async function downloadZipWithFiles(files: { name: string; content: string }[], zipFilename: string) {
  const zip = new JSZip();
  
  files.forEach(file => {
    zip.file(file.name, file.content);
  });
  
  const zipBlob = await zip.generateAsync({ type: 'blob' });
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
