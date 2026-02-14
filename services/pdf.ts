import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { Order, Customer, CompanySettings } from '../types';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

export const pdfService = {
  /**
   * Helper to convert Blob to Base64 for Capacitor
   */
  blobToBase64: (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64data = reader.result as string;
        resolve(base64data.split(',')[1]); // Remove the data:application/pdf;base64, part
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  },

  /**
   * Generates a multi-page PDF by capturing HTML elements matching the selector.
   */
  generateInvoice: async (
    order: Order, 
    customer: Customer, 
    settings: CompanySettings, 
    selector: string = '#invoice-display'
  ): Promise<{ blob: Blob; fileName: string }> => {
    try {
      console.log("Starting Professional PDF Generation...");
      
      const elements = document.querySelectorAll(selector);
      if (elements.length === 0) throw new Error(`Invoice elements not found for selector: ${selector}`);

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();

      for (let i = 0; i < elements.length; i++) {
        const element = elements[i] as HTMLElement;
        
        const canvas = await html2canvas(element, {
          scale: 2, 
          useCORS: true,
          logging: false,
          backgroundColor: "#ffffff",
          windowWidth: 800 
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.8);
        const imgWidthPx = canvas.width;
        const imgHeightPx = canvas.height;
        
        const ratio = pdfWidth / imgWidthPx;
        const canvasHeightInPdfUnits = imgHeightPx * ratio;

        if (i > 0) {
          pdf.addPage();
        }
        
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, canvasHeightInPdfUnits, undefined, 'FAST');
      }

      const fileName = `${order.invoice_number || order.order_id}.pdf`;
      
      const blob = pdf.output('blob');

      // If on Native (Android/iOS)
      if (Capacitor.isNativePlatform()) {
        const base64 = await pdfService.blobToBase64(blob);
        const savedFile = await Filesystem.writeFile({
          path: fileName,
          data: base64,
          directory: Directory.Cache,
        });
        
        await Share.share({
          title: `Download ${fileName}`,
          text: `Invoice for ${customer.shop_name}`,
          url: savedFile.uri,
          dialogTitle: 'Save or Share Invoice'
        });
      } else {
        // Standard Web Download
        pdf.save(fileName);
      }
      
      return { blob, fileName };
    } catch (error) {
      console.error("PDF Generation failed:", error);
      throw error;
    }
  },

  /**
   * Generates a PDF from a generic HTML element selector.
   */
  generatePdfFromElement: async (
    selector: string,
    fileName: string = 'document.pdf'
  ): Promise<{ blob: Blob; fileName: string }> => {
    try {
      console.log(`Generating PDF from selector: ${selector}`);
      const element = document.querySelector(selector) as HTMLElement;
      if (!element) throw new Error(`Element not found for selector: ${selector}`);

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        windowWidth: 1200, 
        onclone: (clonedDoc) => {
          const header = clonedDoc.getElementById('pdf-header');
          if (header) header.style.display = 'block';
          const content = clonedDoc.getElementById('report-content');
          if (content) content.style.color = '#000000';
        }
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.8);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const imgWidthPx = canvas.width;
      const imgHeightPx = canvas.height;
      const ratio = pdfWidth / imgWidthPx;
      const canvasHeightInPdfUnits = imgHeightPx * ratio;

      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, canvasHeightInPdfUnits, undefined, 'FAST');
      
      const blob = pdf.output('blob');

      if (Capacitor.isNativePlatform()) {
        const base64 = await pdfService.blobToBase64(blob);
        const savedFile = await Filesystem.writeFile({
          path: fileName,
          data: base64,
          directory: Directory.Cache,
        });
        await Share.share({
          title: fileName,
          url: savedFile.uri,
        });
      } else {
        pdf.save(fileName);
      }

      return { blob, fileName };
    } catch (error) {
      console.error("PDF Generation failed:", error);
      throw error;
    }
  },

  /**
   * Generates and shares the invoice using the Web Share API or Capacitor Share.
   */
  shareInvoice: async (
    order: Order, 
    customer: Customer, 
    settings: CompanySettings, 
    selector: string = '#invoice-display'
  ): Promise<void> => {
    try {
      if (Capacitor.isNativePlatform()) {
        // Just call the generation logic which includes sharing on native
        await pdfService.generateInvoice(order, customer, settings, selector);
        return;
      }

      const { blob, fileName } = await pdfService.generateInvoice(order, customer, settings, selector);
      
      // Web sharing logic
      const file = new File([blob], fileName, { type: 'application/pdf' });
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `Invoice ${fileName}`,
          text: `Invoice for ${customer.shop_name}`,
          files: [file]
        });
      } else {
        // Fallback for browsers that don't support sharing files
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
      }
    } catch (e) {
      console.error('Sharing failed', e);
    }
  }
};
