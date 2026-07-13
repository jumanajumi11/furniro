import { computeLedgerData, getDateRange, compileReportData } from '../../services/admin/sales.service.js';
import { logger } from '../../utils/logger.js';

// =================== LEDGER BOOK ===================

export const getLedgerBook = async (req, res) => {
    try {
        const filter      = req.query.filter      || 'Monthly';
        const customStart = req.query.customStart || '';
        const customEnd   = req.query.customEnd   || '';
        const page        = parseInt(req.query.page) || 1;
        const limit       = parseInt(req.query.limit) || 15;

        const data = await computeLedgerData(filter, customStart, customEnd);

        const total = data.detailedTable.length;
        const totalPages = Math.ceil(total / limit) || 1;
        const currentPage = Math.max(1, Math.min(page, totalPages));
        const paginatedTable = data.detailedTable.slice((currentPage - 1) * limit, currentPage * limit);

        res.render('admin/ledger-book', {
            openingBalance: data.openingBalance,
            closingBalance: data.closingBalance,
            totalCredits:   data.totalCredits,
            totalDebits:    data.totalDebits,
            detailedTable:  paginatedTable,
            filter,
            customStart,
            customEnd,
            currentPage,
            totalPages,
            limit,
            total,
            activePage: 'ledger'
        });
    } catch (error) {
        console.error('[Admin Ledger] getLedgerBook Error:', error);
        res.status(500).send('Internal Server Error');
    }
};

export const generateLedgerBookPDF = async (req, res) => {
    res.setHeader('Content-Type', 'application/json');

    try {
        logger.debug('[Admin Ledger PDF] Route hit — query params:', req.query);

        const filter      = req.query.filter      || 'Monthly';
        const customStart = req.query.customStart || '';
        const customEnd   = req.query.customEnd   || '';

        logger.debug('[Admin Ledger PDF] Filter:', filter, '| Start:', customStart || '(none)', '| End:', customEnd || '(none)');

        if (filter === 'Custom') {
            if (!customStart) {
                return res.status(400).json({ success: false, error: 'Start Date is required for Custom range.' });
            }
            if (!customEnd) {
                return res.status(400).json({ success: false, error: 'End Date is required for Custom range.' });
            }

            const start = new Date(customStart);
            const end   = new Date(customEnd);
            const today = new Date();
            today.setHours(23, 59, 59, 999);

            if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                return res.status(400).json({ success: false, error: 'Invalid date format provided.' });
            }
            if (start > end) {
                return res.status(400).json({ success: false, error: 'Start Date cannot be after End Date.' });
            }
            if (start > today || end > today) {
                return res.status(400).json({ success: false, error: 'Dates cannot be in the future.' });
            }
        }

        const data = await computeLedgerData(filter, customStart, customEnd);

        logger.debug('[Admin Ledger PDF] Entries in range:', data.detailedTable.length);
        logger.debug('[Admin Ledger PDF] Summary — Opening:', data.openingBalance,
                    '| Credits:', data.totalCredits,
                    '| Debits:', data.totalDebits,
                    '| Closing:', data.closingBalance);

        if (!data.detailedTable || data.detailedTable.length === 0) {
            return res.status(200).json({ success: true, empty: true });
        }

        const serialisedTable = data.detailedTable.map(row => ({
            date:           new Date(row.date).toLocaleString('en-IN', {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                                timeZone: 'Asia/Kolkata'
                            }),
            category:       row.category,
            description:    row.description,
            type:           row.type,
            amount:         row.amount,
            runningBalance: row.runningBalance,
            refId:          row.refId ? row.refId.toString() : ''
        }));

        return res.status(200).json({
            success: true,
            filter,
            customStart,
            customEnd,
            startDate: data.startDate.toLocaleDateString('en-IN', {
                timeZone: 'Asia/Kolkata',
                dateStyle: 'medium'
            }),
            endDate: data.endDate.toLocaleDateString('en-IN', {
                timeZone: 'Asia/Kolkata',
                dateStyle: 'medium'
            }),
            openingBalance: data.openingBalance,
            closingBalance: data.closingBalance,
            totalCredits:   data.totalCredits,
            totalDebits:    data.totalDebits,
            detailedTable:  serialisedTable
        });

    } catch (error) {
        logger.error('[Admin Ledger PDF] generateLedgerBookPDF Error:', error);
        return res.status(500).json({ success: false, error: 'An internal server error occurred while preparing the PDF data.' });
    }
};

// =================== SALES REPORT ===================

export const getSalesReport = async (req, res) => {
    try {
        const filter = req.query.filter || 'Monthly';
        const customStart = req.query.customStart || '';
        const customEnd = req.query.customEnd || '';

        const { startDate, endDate } = getDateRange(filter, customStart, customEnd);
        const report = await compileReportData(startDate, endDate);

        res.render('admin/sales-report', {
            summary: report.summary,
            detailedTable: report.detailedTable,
            filter,
            customStart,
            customEnd,
            activePage: 'sales-report'
        });
    } catch (error) {
        console.error('[Admin Report] getSalesReport Error:', error);
        res.status(500).send('Internal Server Error');
    }
};

export const exportSalesReportCSV = async (req, res) => {
    try {
        const filter = req.query.filter || 'Monthly';
        const customStart = req.query.customStart || '';
        const customEnd = req.query.customEnd || '';

        const { startDate, endDate } = getDateRange(filter, customStart, customEnd);
        const report = await compileReportData(startDate, endDate);

        let csv = 'Sales Report\n';
        csv += `Filter: ${filter}\n`;
        const formattedStart = startDate.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium' });
        const formattedEnd = endDate.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium' });
        csv += `Date Range: ${formattedStart} to ${formattedEnd}\n\n`;
        
        csv += 'SUMMARY SECTION\n';
        csv += `Total Orders,${report.summary.totalOrders}\n`;
        csv += `Total Sales Count,${report.summary.totalSalesCount}\n`;
        csv += `Gross Revenue,INR ${report.summary.grossRevenue}\n`;
        csv += `Coupon Discount,INR ${report.summary.couponDiscount}\n`;
        csv += `Offer Discount,INR ${report.summary.offerDiscount}\n`;
        csv += `Total Discount,INR ${report.summary.totalDiscount}\n`;
        csv += `Net Revenue,INR ${report.summary.netRevenue}\n\n`;

        csv += 'DETAILED SALES TABLE\n';
        csv += 'Order ID,Date,Customer,Payment Method,Order Amount (Gross),Coupon Deduction,Offer Deduction,Final Amount (Net)\n';

        report.detailedTable.forEach(row => {
            const formattedDate = new Date(row.date).toLocaleString('en-IN', {
                dateStyle: 'medium',
                timeStyle: 'short',
                timeZone: 'Asia/Kolkata'
            });
            csv += `"${row.orderId}","${formattedDate}",WrappedTextHere,"${row.customer}","${row.paymentMethod}",${row.orderAmount},${row.couponDeduction},${row.offerDeduction},${row.finalAmount}\n`
                .replace('WrappedTextHere,', '');
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=sales-report-${filter.toLowerCase()}-${Date.now()}.csv`);
        return res.status(200).send(csv);
    } catch (error) {
        console.error('[Admin Report] exportSalesReportCSV Error:', error);
        return res.status(500).send('Internal Server Error');
    }
};

export const printSalesReport = async (req, res) => {
    try {
        const filter = req.query.filter || 'Monthly';
        const customStart = req.query.customStart || '';
        const customEnd = req.query.customEnd || '';

        const { startDate, endDate } = getDateRange(filter, customStart, customEnd);
        const report = await compileReportData(startDate, endDate);

        res.render('admin/print-report', {
            summary: report.summary,
            detailedTable: report.detailedTable,
            filter,
            startDate,
            endDate
        });
    } catch (error) {
        console.error('[Admin Report] printSalesReport Error:', error);
        res.status(500).send('Internal Server Error');
    }
};
