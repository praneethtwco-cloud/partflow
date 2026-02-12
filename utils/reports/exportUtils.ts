import { SalesTrendDataPoint } from '../components/Reports/SalesTrendsChart';
import { TopSellingItem } from '../components/Reports/TopSellingItemsChart';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import html2canvas from 'html2canvas';

/**
 * Exports sales data to PDF format
 * @param salesData Sales trend data to export
 * @param topSellingItems Top selling items data to export
 * @param dateRange Date range for the report
 * @param filters Active filters applied to the data
 */
export const exportSalesReportToPDF = async (
  salesData: SalesTrendDataPoint[],
  topSellingItems: TopSellingItem[],
  dateRange?: { start: Date; end: Date },
  filters?: any
): Promise<void> => {
  const doc = new jsPDF('landscape');
  
  // Add title
  doc.setFontSize(20);
  doc.text('Sales Report', 14, 20);
  
  // Add date range if provided
  if (dateRange) {
    doc.setFontSize(12);
    doc.text(`Date Range: ${dateRange.start.toDateString()} - ${dateRange.end.toDateString()}`, 14, 30);
  }
  
  // Add filters if provided
  if (filters) {
    let filterText = 'Filters: ';
    if (filters.category && filters.category !== 'all') {
      filterText += `Category: ${filters.category}, `;
    }
    if (filters.customer && filters.customer !== 'all') {
      filterText += `Customer: ${filters.customer}, `;
    }
    if (filterText.endsWith(', ')) {
      filterText = filterText.slice(0, -2);
    }
    if (filterText !== 'Filters: ') {
      doc.text(filterText, 14, 40);
    }
  }
  
  // Add sales trends table
  if (salesData && salesData.length > 0) {
    const startY = filters ? 50 : 40;
    
    doc.setFontSize(16);
    doc.text('Sales Trends', 14, startY);
    
    // Prepare table data
    const tableColumn = ['Date', 'Gross Sales', 'Net Sales', 'Transactions'];
    const tableRows = salesData.map(item => [
      item.date,
      `₹${item.grossSales.toLocaleString()}`,
      `₹${item.netSales.toLocaleString()}`,
      item.transactions.toString()
    ]);
    
    // Add table
    (doc as any).autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: startY + 5,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] }, // indigo-600
      styles: { cellPadding: 3, fontSize: 10 }
    });
  }
  
  // Add top selling items table
  if (topSellingItems && topSellingItems.length > 0) {
    const finalY = (doc as any).lastAutoTable.finalY || (filters ? 50 : 40);
    const tableStartY = finalY + 10;
    
    doc.setFontSize(16);
    doc.text('Top Selling Items', 14, tableStartY);
    
    // Prepare table data
    const tableColumn = ['Item Name', 'Quantity Sold', 'Percentage'];
    const tableRows = topSellingItems.map(item => [
      item.name,
      item.quantity.toString(),
      `${item.percentage}%`
    ]);
    
    // Add table
    (doc as any).autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: tableStartY + 5,
      theme: 'grid',
      headStyles: { fillColor: [16, 185, 129] }, // emerald-500
      styles: { cellPadding: 3, fontSize: 10 }
    });
  }
  
  // Save the PDF
  doc.save(`sales-report-${new Date().toISOString().split('T')[0]}.pdf`);
};

/**
 * Exports sales data to image format
 * @param elementId The ID of the HTML element to capture
 * @param filename The name of the file to save
 */
export const exportToImage = async (elementId: string, filename: string): Promise<void> => {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Element with ID '${elementId}' not found`);
    return;
  }
  
  try {
    const canvas = await html2canvas(element);
    const image = canvas.toDataURL('image/png');
    
    // Create a temporary link and trigger download
    const link = document.createElement('a');
    link.href = image;
    link.download = `${filename}.png`;
    link.click();
  } catch (error) {
    console.error('Error exporting to image:', error);
  }
};