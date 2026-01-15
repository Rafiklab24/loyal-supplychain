/**
 * Transfer Order PDF Template
 * Matches Yapi Kredi Bank transfer order form format
 * Uses inline styles and HTML tables for proper pdf rendering with html2canvas
 */

import { forwardRef } from 'react';
import type { TransferOrderData } from '../../types/api';

interface TransferOrderPDFProps {
  data: TransferOrderData;
}

/**
 * Format number with Turkish locale (comma as thousand separator, dot as decimal)
 */
function formatAmount(amount: number): string {
  return new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format date to DD/MM/YYYY format
 */
function formatDate(dateString: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Get transfer type title in Turkish
 */
function getTransferTypeTitle(type: TransferOrderData['transfer_type']): string {
  return type === 'import' 
    ? 'PEŞİN İTHALAT TRANSFER TALİMATI' 
    : 'YURT İÇİ / YURT DIŞI DÖVİZ TRANSFER TALİMATI';
}

// Shared styles
const styles = {
  page: {
    width: '210mm',
    minHeight: '297mm',
    padding: '12mm 15mm',
    fontFamily: 'Arial, Helvetica, sans-serif',
    fontSize: '10pt',
    lineHeight: '1.3',
    backgroundColor: '#ffffff',
    color: '#000000',
    boxSizing: 'border-box' as const,
  },
  header: {
    textAlign: 'right' as const,
    fontSize: '9pt',
    marginBottom: '8px',
    fontWeight: 'bold' as const,
  },
  title: {
    textAlign: 'center' as const,
    fontWeight: 'bold' as const,
    fontSize: '12pt',
    borderBottom: '2px solid #000',
    paddingBottom: '6px',
    marginBottom: '12px',
  },
  topRow: {
    display: 'flex' as const,
    justifyContent: 'space-between' as const,
    marginBottom: '12px',
  },
  section: {
    border: '1px solid #000',
    marginBottom: '10px',
    padding: '8px 10px',
  },
  sectionTitle: {
    fontWeight: 'bold' as const,
    fontSize: '10pt',
    marginBottom: '6px',
    backgroundColor: '#e5e5e5',
    padding: '4px 6px',
    margin: '-8px -10px 8px -10px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
  },
  labelCell: {
    fontWeight: 'bold' as const,
    padding: '3px 4px',
    verticalAlign: 'top' as const,
    width: '35%',
    fontSize: '9pt',
  },
  valueCell: {
    padding: '3px 4px',
    verticalAlign: 'top' as const,
    fontSize: '9pt',
  },
  checkbox: {
    display: 'inline-block',
    width: '12px',
    height: '12px',
    border: '1px solid #000',
    marginRight: '6px',
    verticalAlign: 'middle',
    textAlign: 'center' as const,
    lineHeight: '10px',
    fontSize: '10px',
  },
  checkboxChecked: {
    display: 'inline-block',
    width: '12px',
    height: '12px',
    border: '1px solid #000',
    backgroundColor: '#000',
    color: '#fff',
    marginRight: '6px',
    verticalAlign: 'middle',
    textAlign: 'center' as const,
    lineHeight: '10px',
    fontSize: '10px',
  },
  chargeOption: {
    marginBottom: '6px',
    fontSize: '9pt',
  },
  footer: {
    marginTop: '15px',
    fontSize: '9pt',
  },
  signatureLine: {
    borderTop: '1px solid #000',
    width: '50mm',
    marginTop: '20mm',
    marginLeft: 'auto',
    textAlign: 'center' as const,
    paddingTop: '3px',
    fontSize: '8pt',
  },
};

export const TransferOrderPDF = forwardRef<HTMLDivElement, TransferOrderPDFProps>(
  ({ data }, ref) => {
    return (
      <div ref={ref} style={styles.page}>
        {/* Header - Bank Branch */}
        <div style={styles.header}>
          {data.sender_branch}
        </div>

        {/* Transfer Type Title */}
        <div style={styles.title}>
          {getTransferTypeTitle(data.transfer_type)}
        </div>

        {/* Currency/Amount and Date Row */}
        <table style={{ ...styles.table, marginBottom: '12px' }}>
          <tbody>
            <tr>
              <td style={{ width: '50%', verticalAlign: 'top' }}>
                <div style={{ fontWeight: 'bold', fontSize: '9pt' }}>DÖVİZ CİNSİ VE TUTARI</div>
                <div style={{ fontSize: '14pt', fontWeight: 'bold', marginTop: '2px' }}>
                  {data.currency} {formatAmount(data.amount)}
                </div>
              </td>
              <td style={{ width: '50%', textAlign: 'right', verticalAlign: 'top' }}>
                <div style={{ fontWeight: 'bold', fontSize: '9pt' }}>TARİH</div>
                <div style={{ fontSize: '11pt', marginTop: '2px' }}>
                  {formatDate(data.transfer_date)}
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Sender Section */}
        <div style={{ ...styles.section, backgroundColor: '#f5f5f5' }}>
          <div style={styles.sectionTitle}>
            GÖNDERİCİ / İTHALATÇI BİLGİLERİ
          </div>
          <table style={styles.table}>
            <tbody>
              <tr>
                <td style={styles.labelCell}>Adı Soyadı / Ünvanı</td>
                <td style={styles.valueCell}>{data.sender_name}</td>
              </tr>
              <tr>
                <td style={styles.labelCell}>Müşteri Numarası</td>
                <td style={styles.valueCell}>{data.sender_customer_number}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Beneficiary Section */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>
            ALICI / İHRACATÇI BİLGİLERİ
          </div>
          <table style={styles.table}>
            <tbody>
              <tr>
                <td style={styles.labelCell}>Adı Soyadı / Ünvanı</td>
                <td style={styles.valueCell}>{data.beneficiary_name}</td>
              </tr>
              <tr>
                <td style={styles.labelCell}>Adresi</td>
                <td style={styles.valueCell}>{data.beneficiary_address}</td>
              </tr>
              <tr>
                <td style={styles.labelCell}>Banka Adı, Şubesi ve Ülkesi</td>
                <td style={styles.valueCell}>
                  {data.bank_name}
                  {data.bank_branch && <><br />{data.bank_branch}</>}
                  {data.bank_address && <><br />{data.bank_address}</>}
                  {data.bank_country && <> - {data.bank_country}</>}
                </td>
              </tr>
              <tr>
                <td style={styles.labelCell}>Banka SWIFT Kodu</td>
                <td style={styles.valueCell}>{data.swift_code}</td>
              </tr>
              <tr>
                <td style={styles.labelCell}>
                  IBAN Numarası<br />
                  <span style={{ fontWeight: 'normal', fontSize: '8pt', color: '#666' }}>
                    (IBAN'ı bilmiyorsanız lütfen aşağıdaki seçeneği işaretleyiniz)
                  </span>
                </td>
                <td style={styles.valueCell}>
                  <div style={{ marginBottom: '4px' }}>
                    <span style={data.iban_unknown ? styles.checkboxChecked : styles.checkbox}>
                      {data.iban_unknown ? '✓' : ''}
                    </span>
                    <span style={{ fontSize: '8pt' }}>Alıcıya ait IBAN'ı bilmiyorum.</span>
                  </div>
                  <div>{data.iban_or_account}</div>
                </td>
              </tr>
              <tr>
                <td style={styles.labelCell}>Hesap Bankasının Muhabiri (Biliniyorsa)</td>
                <td style={styles.valueCell}>{data.correspondent_bank || '-'}</td>
              </tr>
              <tr>
                <td style={styles.labelCell}>Proforma / Fatura Tarih ve No</td>
                <td style={styles.valueCell}>{data.invoice_info}</td>
              </tr>
              <tr>
                <td style={styles.labelCell}>Ödeme Detayları</td>
                <td style={styles.valueCell}>{data.payment_details || ''}</td>
              </tr>
              {data.value_date && (
                <tr>
                  <td style={styles.labelCell}>VALÖR TARİHİ</td>
                  <td style={styles.valueCell}>
                    {data.value_date === 'TODAY' ? 'BUGÜN' : formatDate(data.value_date)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Charges Section */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>
            MASRAFLAR (USD HESABINDAN)
          </div>
          
          <div style={styles.chargeOption}>
            <span style={data.charge_type === 'SHA' ? styles.checkboxChecked : styles.checkbox}>
              {data.charge_type === 'SHA' ? '✓' : ''}
            </span>
            <strong>SHA</strong>
            <span style={{ marginLeft: '8px' }}>
              (Gönderici (ithalatçı) tarafındaki masraflar göndericiye, diğer tüm masraflar alıcıya aittir.)
            </span>
          </div>

          <div style={styles.chargeOption}>
            <span style={data.charge_type === 'OUR' ? styles.checkboxChecked : styles.checkbox}>
              {data.charge_type === 'OUR' ? '✓' : ''}
            </span>
            <strong>OUR</strong>
            <span style={{ marginLeft: '8px' }}>
              (Tüm masraflar gönderici (ithalatçı / amir / müşterilerimiz) tarafından ödenecektir.)
            </span>
          </div>

          <div style={styles.chargeOption}>
            <span style={data.charge_type === 'BEN' ? styles.checkboxChecked : styles.checkbox}>
              {data.charge_type === 'BEN' ? '✓' : ''}
            </span>
            <strong>BEN</strong>
            <span style={{ marginLeft: '8px' }}>
              (Tüm masraflar alıcı (ihracatçı / lehtar) tarafından ödenecektir.)
            </span>
          </div>
        </div>

        {/* Divider */}
        <div style={{ borderTop: '1px solid #000', margin: '15px 0' }} />

        {/* Footer */}
        <div style={styles.footer}>
          <p>Yukarıda verdiğim detaylara göre transfer işleminin yapılmasını rica ederim. Saygılarım(ız)la.</p>
          
          <div style={styles.signatureLine}>
            İmza / Kaşe
          </div>
        </div>
      </div>
    );
  }
);

TransferOrderPDF.displayName = 'TransferOrderPDF';

export default TransferOrderPDF;
