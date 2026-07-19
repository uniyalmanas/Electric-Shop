export type Language = 'en' | 'hinglish';

export const translations = {
  en: {
    // Header & Dashboard titles
    ownerDashboard: "Owner Dashboard",
    activeStaff: "Active Staff Members",
    registerStaff: "Register Staff Member",
    registeredWorkers: "Registered Workers",
    recentStockMovements: "Recent Stock movements audit log (Top 25)",
    time: "Time",
    staff: "Staff",
    product: "Product",
    qty: "Qty",
    direction: "Direction",
    reason: "Reason",
    loadingStaff: "Loading staff statements...",
    noStockMovements: "No stock movements recorded yet.",
    cancel: "Cancel",
    registerBtn: "Register Staff",
    staffName: "Staff Name",
    phoneLogin: "Phone Number (For Login)",
    emailOptional: "Email Address (Optional)",
    loginPassword: "Login Password",
    shopRole: "Shop Role",
    staffRoleOpt: "Staff Member (Counter access only)",
    ownerRoleOpt: "Co-Owner (Full access)",
    activeStatus: "Active",
    inactiveStatus: "Inactive",
    deactivate: "Deactivate",
    activate: "Activate",
    
    // Main Dashboard Summary
    todaySales: "Today's Sales",
    cashReceived: "Cash Received",
    lowStock: "Low Stock",
    duesReceivable: "Dues Receivable",
    duesPayable: "Dues Payable",
    quickLinks: "Quick Action Panels",
    
    // Nav Items
    inventoryLabel: "Inventory Catalog",
    inventoryDesc: "Audit stock levels, edit prices, and review reorder alerts.",
    contractorLabel: "Contractor Dues",
    contractorDesc: "Track credit balances, accept cash repayments, and clear customer khata.",
    expensesLabel: "Daily Expenses",
    expensesDesc: "Record shop rent, electric bills, refreshments, and miscellaneous expenses.",
    reportsLabel: "GST Tax Reports",
    reportsDesc: "Download GSTR-1/3B summaries and tax spreadsheets for your CA.",
    suppliersLabel: "Supplier Ledger",
    suppliersDesc: "Track distributor invoices, pending payments, and purchase logs.",
    reconciliationLabel: "Stock Audit Logs",
    reconciliationDesc: "Verify counter counts vs system stock, and resolve audit discrepancies.",
    settingsLabel: "Shop Settings",
    settingsDesc: "Update store name, tax rates, and global billing configurations.",
    
    // Auth & Generic
    logout: "Logout",
    loadingMetrics: "Loading metrics..."
  },
  hinglish: {
    // Header & Dashboard titles
    ownerDashboard: "Owner Dashboard",
    activeStaff: "Active Staff Members",
    registerStaff: "Naya Staff Add Karein",
    registeredWorkers: "Registered Workers List",
    recentStockMovements: "Stock Aana-Jaana Logs (Top 25)",
    time: "Time",
    staff: "Staff Name",
    product: "Samaan",
    qty: "Quantity",
    direction: "Status",
    reason: "Reason",
    loadingStaff: "Staff logs load ho rahe hain...",
    noStockMovements: "Abhi tak koi stock movement nahi hui.",
    cancel: "Cancel",
    registerBtn: "Staff Register Karein",
    staffName: "Staff ka Naam",
    phoneLogin: "Mobile Number (Login ke liye)",
    emailOptional: "Email ID (Zaroori nahi)",
    loginPassword: "Login Password",
    shopRole: "Shop Role",
    staffRoleOpt: "Staff Member (Sirf counter bill banayega)",
    ownerRoleOpt: "Co-Owner (Sab access milega)",
    activeStatus: "Active",
    inactiveStatus: "Ruka Hua",
    deactivate: "Band karein",
    activate: "Chalu karein",
    
    // Main Dashboard Summary
    todaySales: "Aaj ki Sales",
    cashReceived: "Cash Received (Galla)",
    lowStock: "Stock Khatam",
    duesReceivable: "Contractor Baki (Lena)",
    duesPayable: "Supplier Baki (Dena)",
    quickLinks: "Kaam ke Action Panels",
    
    // Nav Items
    inventoryLabel: "Inventory aur Samaan",
    inventoryDesc: "Samaan ka stock check karein, rates badlein aur naye items dalein.",
    contractorLabel: "Grahak/Contractor Baki (Khata)",
    contractorDesc: "Udhaari ka hisab rakhein aur grahak ka payment jama karein.",
    expensesLabel: "Rozana Karche",
    expensesDesc: "Rent, bijli bill, chai-paani aur baki karche note karein.",
    reportsLabel: "GST Tax Reports",
    reportsDesc: "CA ke liye GSTR-1/3B data aur GST tax report download karein.",
    suppliersLabel: "Supplier Udhaari Ledger",
    suppliersDesc: "Distributor bills, baki payment aur purchase history dekhein.",
    reconciliationLabel: "Stock Reconciliation Logs",
    reconciliationDesc: "Counter par rakha samaan aur computer ka stock milayein.",
    settingsLabel: "Dukaan ki Settings",
    settingsDesc: "Dukaan ka naam, GST rate aur counter details update karein.",
    
    // Auth & Generic
    logout: "Log Out",
    loadingMetrics: "Data load ho raha hai..."
  }
};
