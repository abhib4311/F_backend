
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Validates and returns date range based on time filter
 * @param {string} time - Time filter ('today', 'weekly', 'monthly', 'yearly')
 * @returns {Object} Date range object with start and end dates
 */
const getDateRange = (time) => {
  const now = new Date();
  let startDate = null;
  let endDate = null;

  switch (time) {
    case 'today':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      break;

    case 'weekly': {
      const currentDay = now.getDay();
      const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay;
      startDate = new Date(now);
      startDate.setDate(now.getDate() + diffToMonday);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);
      break;
    }

    case 'monthly':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      break;

    case 'yearly':
      startDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      break;

    default:
      return null;
  }

  return { startDate, endDate };
};

/**
 * Get admin dashboard statistics
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getAdminDashboardStats = async (req, res) => {
  try {
    const { time } = req.query;

    // if (time && !['today', 'weekly', 'monthly', 'yearly'].includes(time)) {
    //   return res.status(400).json({
    //     success: false,
    //     message: 'Invalid time parameter. Must be one of: today, weekly, monthly, yearly',
    //   });
    // }

    const dateRange = time ? getDateRange(time) : null;
    const prismaDateRange = dateRange ? { gte: dateRange.startDate, lte: dateRange.endDate } : undefined;

    const [
      totalApplicationsDisbursed,
      avgLoanSize,
      totalAmountDisbursed,
      pendingDisbursalAmount,
      pendingCases,
      statusCounts
    ] = await Promise.all([
      prisma.disbursal.count({
        // where: prismaDateRange ? { disbursal_date: prismaDateRange } : undefined
      }),

      prisma.disbursal.aggregate({
        _avg: { loan_amount: true },
        // where: prismaDateRange ? { disbursal_date: prismaDateRange } : undefined
      }),

      prisma.disbursal.aggregate({
        _sum: { loan_amount: true },
        where: prismaDateRange ? { disbursal_date: prismaDateRange } : undefined
      }),

      prisma.sanction.aggregate({
        _sum: { loan_amount: true },
        where: {
          is_disbursed: false,
          is_rejected: false,
          ...(prismaDateRange && { sanction_date: prismaDateRange })
        }
      }),

      prisma.lead.count({
        where: {
          is_disbursed: false,
          is_rejected: false,
          sanction: {
            ...(prismaDateRange && { updated_at: prismaDateRange })
          }
        }
      }),

      Promise.all([
        // prisma.lead.count({
        //   where: {
        //     is_sanction: true,
        //     is_disbursed: false,
        //     is_rejected:false,
        //     sanction: prismaDateRange ? { sanction_date: prismaDateRange } : undefined
        //   }
        // }),

        prisma.lead.count({
          where: {
            is_rejected: true,
            ...(prismaDateRange && { updated_at: prismaDateRange })
          }
        }),

        prisma.disbursal.count({
          where: {
            is_disbursed: true,
            ...(prismaDateRange && { disbursal_date: prismaDateRange })
          }
        }),

        prisma.lead.count({
          where: {
            is_rejected: false,
            is_rejected: false,
            ...(prismaDateRange && { updated_at: prismaDateRange })
          }
        }),
      ])
    ]);

    res.json({
      success: true,
      timeFilter: dateRange ? { startDate: dateRange.startDate, endDate: dateRange.endDate } : "overall",
      data: {
        totalApplicationsDisbursed,
        avgLoanSize: avgLoanSize._avg.loan_amount || 0,
        totalAmountDisbursed: totalAmountDisbursed._sum.loan_amount || 0,
        pendingDisbursalAmount: pendingDisbursalAmount._sum.loan_amount || 0,
        pendingCases,
        statusCounts: {
          // approved: statusCounts[0],
          rejected: statusCounts[0],
          disbursed: statusCounts[1],
          pending: statusCounts[2]
        }
      }
    });
  } catch (error) {
    console.error('Error fetching admin dashboard stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard statistics',
      error: error.message
    });
  }
};