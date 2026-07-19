import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import PDFDocument from 'pdfkit';

// Initialize Supabase Admin Client using the Service Role Key to bypass RLS policies
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

// Helper function to build the A5 invoice PDF in memory as a Buffer
function generateInvoicePDF(sale: any, items: any[], customer: any, shopName: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A5', margin: 30 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      // 1. Header Branding
      doc.fillColor('#C1793D').fontSize(16).font('Helvetica-Bold').text(shopName.toUpperCase(), { align: 'center' });
      doc.fillColor('#707C7F').fontSize(8).font('Helvetica').text('Electrical Hardware, MCBs, wires & Lights', { align: 'center' });
      doc.text('Authorized Retailer & Distributor', { align: 'center' });
      doc.moveDown(1);

      // 2. Metadata details
      doc.fillColor('#14181B').fontSize(9);
      doc.text(`Invoice ID: ${sale.id.slice(0, 8).toUpperCase()}`);
      doc.text(`Date: ${new Date(sale.created_at).toLocaleString('en-IN')}`);
      doc.text(`Customer: ${customer ? customer.name : 'Walk-in Client'}`);
      if (customer && customer.phone) {
        doc.text(`Phone: ${customer.phone}`);
      }
      doc.text(`Payment Mode: ${sale.payment_type.toUpperCase()}`);
      doc.moveDown(0.5);

      // Dashed Line Separator
      doc.text('---------------------------------------------------------------------------------', { align: 'center' });
      doc.moveDown(0.5);

      // 3. Invoice Table Header
      doc.font('Helvetica-Bold').fontSize(9);
      doc.text('Item Description', 30, doc.y, { width: 140, continued: true });
      doc.text('Qty', 170, doc.y, { width: 30, align: 'center', continued: true });
      doc.text('Rate', 200, doc.y, { width: 50, align: 'right', continued: true });
      doc.text('Total', 250, doc.y, { width: 50, align: 'right' });
      
      doc.font('Helvetica');
      doc.moveDown(0.3);
      doc.text('................................................................................................................', { align: 'center' });
      doc.moveDown(0.5);

      // 4. Print Table Rows
      for (const item of items) {
        const productName = item.products?.name || 'Unknown Product';
        doc.text(productName, 30, doc.y, { width: 140, continued: true });
        doc.text(String(item.quantity), 170, doc.y, { width: 30, align: 'center', continued: true });
        doc.text(`₹${Number(item.price).toFixed(1)}`, 200, doc.y, { width: 50, align: 'right', continued: true });
        doc.text(`₹${(item.quantity * item.price).toFixed(1)}`, 250, doc.y, { width: 50, align: 'right' });
        doc.moveDown(0.5);
      }

      doc.moveDown(0.3);
      doc.text('---------------------------------------------------------------------------------', { align: 'center' });
      doc.moveDown(0.5);

      // 5. Totals Area
      doc.font('Helvetica-Bold');
      doc.text(`Grand Total: ₹${Number(sale.total_amount).toLocaleString()}`, { align: 'right' });
      doc.text(`Amount Paid: ₹${Number(sale.amount_paid).toLocaleString()}`, { align: 'right' });
      
      if (Number(sale.amount_due) > 0) {
        doc.fillColor('#D9584C');
        doc.text(`Balance Due (Credit): ₹${Number(sale.amount_due).toLocaleString()}`, { align: 'right' });
        doc.fillColor('#14181B');
      }

      doc.moveDown(1.5);
      doc.fontSize(8).font('Helvetica-Oblique').text('Thank you for purchasing with us!', { align: 'center' });
      doc.font('Helvetica').text('Please check item warranty details at the counter.', { align: 'center' });
      doc.text(`Powered by ${shopName} POS`, { align: 'center' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const saleId = params.id;

  try {
    // 1. Fetch Sale details from database
    const { data: sale, error: saleErr } = await supabaseAdmin
      .from('sales')
      .select('*')
      .eq('id', saleId)
      .single();

    if (saleErr || !sale) {
      return NextResponse.json({ error: 'Sale not found: ' + saleErr?.message }, { status: 404 });
    }

    // 2. Fetch Sale Items
    const { data: items, error: itemsErr } = await supabaseAdmin
      .from('sale_items')
      .select('*, products(name)')
      .eq('sale_id', saleId);

    if (itemsErr || !items) {
      return NextResponse.json({ error: 'Sale items not found' }, { status: 404 });
    }

    // 3. Fetch Customer
    let customer = null;
    if (sale.customer_id) {
      const { data: cust } = await supabaseAdmin
        .from('customers')
        .select('*')
        .eq('id', sale.customer_id)
        .single();
      customer = cust;
    }

    // 3.5 Fetch Shop details
    const { data: shop } = await supabaseAdmin
      .from('shops')
      .select('name')
      .eq('id', sale.shop_id)
      .single();
    
    const shopName = shop?.name || 'ElectroStock';

    // 4. Generate the PDF buffer
    console.log(`Generating PDF for Sale ${saleId}...`);
    const pdfBuffer = await generateInvoicePDF(sale, items, customer, shopName);

    // 5. Upload PDF to Supabase Storage Bucket 'invoices'
    const filename = `invoice_${saleId}.pdf`;
    console.log(`Uploading ${filename} to Supabase Storage...`);
    const { error: uploadErr } = await supabaseAdmin.storage
      .from('invoices')
      .upload(filename, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (uploadErr) {
      console.error('Supabase bucket upload failed:', uploadErr);
      return NextResponse.json({ error: 'Storage upload failed: ' + uploadErr.message }, { status: 500 });
    }

    // 6. Get Public File URL
    const { data: urlData } = supabaseAdmin.storage
      .from('invoices')
      .getPublicUrl(filename);
    
    const publicUrl = urlData.publicUrl;
    console.log(`Public URL generated: ${publicUrl}`);

    // 7. Push to WhatsApp if API keys are configured
    const instance = process.env.WHATSAPP_INSTANCE || process.env.NEXT_PUBLIC_WHATSAPP_INSTANCE;
    const token = process.env.WHATSAPP_TOKEN || process.env.NEXT_PUBLIC_WHATSAPP_TOKEN;

    let waSuccess = false;
    let waMessage = 'WhatsApp gateway keys not configured in environment (mock fallback active).';

    let phone = customer?.phone ? customer.phone.replace(/\D/g, '') : '';
    if (phone.length === 10) {
      phone = '91' + phone; // India prefix
    }

    if (phone && instance && token) {
      try {
        console.log(`Sending WhatsApp document to ${phone}...`);
        const url = `https://api.ultramsg.com/${instance}/messages/document`;
        
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            token,
            to: phone,
            document: publicUrl,
            filename: `invoice_${saleId.slice(0, 8).toUpperCase()}.pdf`,
            caption: `Namaste ${customer.name || 'ji'},\nThank you for purchasing at ${shopName}! Here is your digital tax invoice.\n\nGrand Total: ₹${Number(sale.total_amount).toLocaleString()}\n\nOutstanding Balance: ₹${Number(sale.amount_due).toLocaleString()}`
          })
        });

        const resData = await response.json();
        console.log('WhatsApp API response:', resData);
        if (resData.sent === 'true' || resData.success) {
          waSuccess = true;
          waMessage = 'PDF Invoice sent successfully over WhatsApp!';
        } else {
          waMessage = 'WhatsApp API responded with failure: ' + JSON.stringify(resData);
        }
      } catch (err: any) {
        console.error('WhatsApp API execution error:', err);
        waMessage = 'WhatsApp API request failed: ' + err.message;
      }
    } else if (!phone) {
      waMessage = 'Walk-in customer has no phone number registered. PDF invoice created and stored in cloud.';
    }

    return NextResponse.json({
      success: true,
      message: 'PDF generated and processed successfully.',
      pdfUrl: publicUrl,
      whatsapp: {
        sent: waSuccess,
        log: waMessage
      }
    });

  } catch (err: any) {
    console.error('Unhandled PDF Generation Error:', err);
    return NextResponse.json({ error: 'Server error: ' + err.message }, { status: 500 });
  }
}
