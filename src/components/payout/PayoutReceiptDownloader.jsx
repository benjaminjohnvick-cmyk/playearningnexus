import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

export default function PayoutReceiptDownloader({ payout, user }) {
  const [loading, setLoading] = useState(false);

  const downloadPDF = async () => {
    setLoading(true);
    try {
      // Dynamically import jsPDF to keep bundle lean
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });

      const pageW = doc.internal.pageSize.getWidth();
      const margin = 20;

      // Header band
      doc.setFillColor(67, 56, 202); // indigo-700
      doc.rect(0, 0, pageW, 40, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.text('GamerGain', margin, 18);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text('Payout Receipt', margin, 28);
      doc.setFontSize(9);
      doc.text(`Generated: ${format(new Date(), 'MMM dd, yyyy HH:mm')}`, pageW - margin, 28, { align: 'right' });

      // Receipt ID
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(9);
      doc.text(`Receipt ID: ${payout.id || 'N/A'}`, margin, 50);

      // Divider
      doc.setDrawColor(220, 220, 220);
      doc.line(margin, 54, pageW - margin, 54);

      // Recipient block
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 30, 30);
      doc.text('Recipient', margin, 64);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      doc.text(user?.full_name || 'GamerGain User', margin, 72);
      doc.text(payout.recipient_email || user?.email || '—', margin, 79);
      doc.text(`Method: ${(payout.method || 'paypal').toUpperCase()}`, margin, 86);

      // Amount block (right side)
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 30, 30);
      doc.text('Payout Amount', pageW / 2 + 10, 64);
      doc.setFontSize(22);
      doc.setTextColor(22, 163, 74); // green-600
      doc.text(`$${(payout.amount || 0).toFixed(2)}`, pageW / 2 + 10, 76);
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.setFont('helvetica', 'normal');
      const statusColors = { completed: [22, 163, 74], pending: [202, 138, 4], failed: [220, 38, 38] };
      const sc = statusColors[payout.status] || [100, 100, 100];
      doc.setTextColor(...sc);
      doc.text(`Status: ${(payout.status || '').toUpperCase()}`, pageW / 2 + 10, 84);

      doc.setDrawColor(220, 220, 220);
      doc.line(margin, 95, pageW - margin, 95);

      // Details table
      const rows = [
        ['Payout Type', (payout.payout_type || '—').replace(/_/g, ' ')],
        ['Description', payout.description || '—'],
        ['Date Initiated', payout.created_date ? format(new Date(payout.created_date), 'MMM dd, yyyy') : '—'],
        ['Completed Date', payout.completed_date ? format(new Date(payout.completed_date), 'MMM dd, yyyy') : '—'],
        ['Transaction ID', payout.external_transaction_id || payout.paypal_batch_id || '—'],
        ['Currency', payout.currency || 'USD'],
      ];

      let y = 105;
      doc.setFontSize(10);
      rows.forEach(([label, value], idx) => {
        if (idx % 2 === 0) {
          doc.setFillColor(248, 248, 252);
          doc.rect(margin, y - 5, pageW - margin * 2, 10, 'F');
        }
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(80, 80, 80);
        doc.text(label, margin + 2, y);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(30, 30, 30);
        doc.text(String(value).slice(0, 60), margin + 60, y);
        y += 12;
      });

      // Footer
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, 268, pageW - margin, 268);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text('GamerGain · support@gamergain.com · This is an automated receipt.', pageW / 2, 274, { align: 'center' });

      doc.save(`GamerGain-Payout-${payout.id || 'receipt'}.pdf`);
    } catch (err) {
      console.error('PDF error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={downloadPDF} disabled={loading}>
      {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
      PDF Receipt
    </Button>
  );
}