/**
 * Excel Export Translations
 * Provides translations for Excel export headers and values
 */

export const excelTranslations = {
  en: {
    // Sheet names
    batchSummary: 'Batch Summary',
    batchItems: 'Batch Items',
    totalsBreakdown: 'Totals Breakdown',
    
    // Column headers
    field: 'Field',
    value: 'Value',
    category: 'Category',
    amount: 'Amount',
    
    // Summary fields
    batchNumber: 'Batch Number',
    status: 'Status',
    numberOfItems: 'Number of Items',
    totalClearingCost: 'Total Clearing Cost',
    createdBy: 'Created By',
    createdDate: 'Created Date',
    submittedDate: 'Submitted Date',
    reviewedBy: 'Reviewed By',
    reviewedDate: 'Reviewed Date',
    notes: 'Notes',
    
    // Item columns
    fileNumber: 'File Number',
    transactionType: 'Transaction Type',
    goodsType: 'Goods Type',
    containersOrCars: 'Containers/Cars',
    weight: 'Weight',
    clearanceType: 'Clearance Type',
    costDescription: 'Cost Description',
    destinationFB: 'Destination/FB',
    costPaidBy: 'Cost Paid By',
    originalClearanceAmount: 'Original Clearance Amount',
    extraCost: 'Extra Cost',
    totalCost: 'Total Clearing Cost',
    clientName: 'Client Name',
    invoiceAmount: 'Invoice Amount',
    currency: 'Currency',
    invoiceNumber: 'Invoice Number',
    invoiceDate: 'Invoice Date',
    bolNumber: 'BOL Number',
    carPlate: 'Car Plate',
    extraCostDescription: 'Extra Cost Description',
    paymentStatus: 'Payment Status',
    
    // Totals
    costPaidByCompany: 'Cost Paid by Company',
    costPaidByClient: 'Cost Paid by Client/FB',
    extraUnusualCosts: 'Extra/Unusual Costs',
    totalClearingCostLabel: 'TOTAL CLEARING COST',
    
    // Values
    company: 'Company',
    client: 'Client',
    pending: 'Pending',
    approved: 'Approved',
    archived: 'Archived',
    inbound: 'Inbound',
    outbound: 'Outbound',
    paid: 'Paid',
    partial: 'Partial',
    notAvailable: 'N/A',
  },
  ar: {
    // Sheet names
    batchSummary: 'ملخص الدفعة',
    batchItems: 'عناصر الدفعة',
    totalsBreakdown: 'تفصيل الإجماليات',
    
    // Column headers
    field: 'الحقل',
    value: 'القيمة',
    category: 'الفئة',
    amount: 'المبلغ',
    
    // Summary fields
    batchNumber: 'رقم الدفعة',
    status: 'الحالة',
    numberOfItems: 'عدد العناصر',
    totalClearingCost: 'إجمالي تكلفة التخليص',
    createdBy: 'تم الإنشاء بواسطة',
    createdDate: 'تاريخ الإنشاء',
    submittedDate: 'تاريخ الإرسال',
    reviewedBy: 'تمت المراجعة بواسطة',
    reviewedDate: 'تاريخ المراجعة',
    notes: 'ملاحظات',
    
    // Item columns
    fileNumber: 'رقم الملف',
    transactionType: 'نوع المعاملة',
    goodsType: 'نوع البضائع',
    containersOrCars: 'عدد الحاويات/السيارات',
    weight: 'وزن البضائع',
    clearanceType: 'نوع التخليص',
    costDescription: 'وصف التكلفة',
    destinationFB: 'الوجهة/المستفيد النهائي',
    costPaidBy: 'الجهة المسؤولة عن التكلفة',
    originalClearanceAmount: 'مبلغ التخليص الأصلي',
    extraCost: 'تكلفة إضافية',
    totalCost: 'إجمالي تكلفة التخليص',
    clientName: 'اسم العميل',
    invoiceAmount: 'مبلغ الفاتورة',
    currency: 'العملة',
    invoiceNumber: 'رقم الفاتورة',
    invoiceDate: 'تاريخ الفاتورة',
    bolNumber: 'رقم البوليصة',
    carPlate: 'رقم السيارة',
    extraCostDescription: 'وصف التكلفة الإضافية',
    paymentStatus: 'حالة الدفع',
    
    // Totals
    costPaidByCompany: 'التكلفة التي تدفعها الشركة',
    costPaidByClient: 'التكلفة التي يدفعها العميل/المستفيد',
    extraUnusualCosts: 'تكاليف إضافية/غير عادية',
    totalClearingCostLabel: 'إجمالي تكلفة التخليص',
    
    // Values
    company: 'الشركة',
    client: 'العميل',
    pending: 'قيد الانتظار',
    approved: 'موافق عليها',
    archived: 'مؤرشفة',
    inbound: 'وارد',
    outbound: 'صادر',
    paid: 'مدفوع',
    partial: 'جزئي',
    notAvailable: 'غير متوفر',
  },
};

export type ExcelLanguage = 'en' | 'ar';

export function getExcelTranslation(lang: ExcelLanguage, key: string): string {
  return excelTranslations[lang][key as keyof typeof excelTranslations.en] || key;
}

export function translateStatus(status: string, lang: ExcelLanguage): string {
  const statusMap: Record<string, keyof typeof excelTranslations.en> = {
    'pending': 'pending',
    'approved': 'approved',
    'archived': 'archived',
  };
  return getExcelTranslation(lang, statusMap[status.toLowerCase()] || 'notAvailable');
}

export function translateClearanceType(type: string | null, lang: ExcelLanguage): string {
  if (!type) return getExcelTranslation(lang, 'notAvailable');
  const typeMap: Record<string, keyof typeof excelTranslations.en> = {
    'inbound': 'inbound',
    'outbound': 'outbound',
  };
  return getExcelTranslation(lang, typeMap[type.toLowerCase()] || 'notAvailable');
}

export function translatePaymentStatus(status: string, lang: ExcelLanguage): string {
  const statusMap: Record<string, keyof typeof excelTranslations.en> = {
    'pending': 'pending',
    'paid': 'paid',
    'partial': 'partial',
  };
  return getExcelTranslation(lang, statusMap[status.toLowerCase()] || 'notAvailable');
}

export function translateCostPaidBy(item: any, lang: ExcelLanguage): string {
  if (item.cost_paid_by_company) {
    return getExcelTranslation(lang, 'company');
  } else if (item.cost_paid_by_fb) {
    return getExcelTranslation(lang, 'client');
  }
  return getExcelTranslation(lang, 'notAvailable');
}

