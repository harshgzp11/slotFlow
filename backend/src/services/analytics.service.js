import mongoose from 'mongoose';
import { Booking } from '../models/Booking.js';
import { Staff } from '../models/Staff.js';
import { Business } from '../models/Business.js';

/**
 * Computes business analytics using MongoDB aggregation pipelines
 * @param {Object} params
 * @param {ObjectId} params.businessId
 * @param {Date} [params.startDate]
 * @param {Date} [params.endDate]
 */
export async function computeBusinessAnalytics(params) {
  const { businessId } = params;

  // Default date window: past 30 days to now + 7 days
  const now = new Date();
  const startDate = params.startDate ? new Date(params.startDate) : new Date(now.getTime() - 30 * 86400000);
  const endDate = params.endDate ? new Date(params.endDate) : new Date(now.getTime() + 7 * 86400000);

  const matchStage = {
    $match: {
      businessId: new mongoose.Types.ObjectId(businessId),
      startTimeUtc: { $gte: startDate, $lte: endDate }
    }
  };

  // 1. Overall Metrics Aggregation
  const [metricsResult] = await Booking.aggregate([
    matchStage,
    {
      $facet: {
        totals: [
          {
            $group: {
              _id: null,
              totalBookings: { $sum: 1 },
              completedBookings: {
                $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] }
              },
              confirmedBookings: {
                $sum: { $cond: [{ $eq: ['$status', 'CONFIRMED'] }, 1, 0] }
              },
              cancelledBookings: {
                $sum: { $cond: [{ $eq: ['$status', 'CANCELLED'] }, 1, 0] }
              },
              noShowBookings: {
                $sum: { $cond: [{ $eq: ['$status', 'NO_SHOW'] }, 1, 0] }
              },
              totalRevenue: {
                $sum: {
                  $cond: [
                    { $in: ['$status', ['COMPLETED', 'CONFIRMED', 'CHECKED_IN', 'IN_SERVICE']] },
                    '$priceSnapshot',
                    0
                  ]
                }
              },
              recoveredRevenue: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $eq: ['$source', 'WAITLIST_RECOVERY'] },
                        { $in: ['$status', ['COMPLETED', 'CONFIRMED', 'CHECKED_IN', 'IN_SERVICE']] }
                      ]
                    },
                    '$priceSnapshot',
                    0
                  ]
                }
              },
              recoveredBookingsCount: {
                $sum: {
                  $cond: [{ $eq: ['$source', 'WAITLIST_RECOVERY'] }, 1, 0]
                }
              },
              bookedMinutes: {
                $sum: {
                  $cond: [
                    { $ne: ['$status', 'CANCELLED'] },
                    '$durationMinutesSnapshot',
                    0
                  ]
                }
              }
            }
          }
        ],
        bySource: [
          {
            $group: {
              _id: '$source',
              count: { $sum: 1 },
              revenue: {
                $sum: {
                  $cond: [
                    { $ne: ['$status', 'CANCELLED'] },
                    '$priceSnapshot',
                    0
                  ]
                }
              }
            }
          }
        ],
        byStaff: [
          {
            $group: {
              _id: '$staffId',
              totalBookings: { $sum: 1 },
              completedBookings: {
                $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] }
              },
              revenue: {
                $sum: {
                  $cond: [{ $ne: ['$status', 'CANCELLED'] }, '$priceSnapshot', 0]
                }
              },
              bookedMinutes: {
                $sum: {
                  $cond: [{ $ne: ['$status', 'CANCELLED'] }, '$durationMinutesSnapshot', 0]
                }
              }
            }
          },
          {
            $lookup: {
              from: 'staffs',
              localField: '_id',
              foreignField: '_id',
              as: 'staffDetails'
            }
          },
          {
            $unwind: {
              path: '$staffDetails',
              preserveNullAndEmptyArrays: true
            }
          },
          {
            $project: {
              staffId: '$_id',
              displayName: { $ifNull: ['$staffDetails.displayName', 'Unknown Staff'] },
              totalBookings: 1,
              completedBookings: 1,
              revenue: 1,
              bookedMinutes: 1
            }
          }
        ]
      }
    }
  ]);

  const summary = metricsResult?.totals[0] || {
    totalBookings: 0,
    completedBookings: 0,
    confirmedBookings: 0,
    cancelledBookings: 0,
    noShowBookings: 0,
    totalRevenue: 0,
    recoveredRevenue: 0,
    recoveredBookingsCount: 0,
    bookedMinutes: 0
  };

  const cancellationRate =
    summary.totalBookings > 0
      ? Number(((summary.cancelledBookings / summary.totalBookings) * 100).toFixed(1))
      : 0;

  // Calculate staff shift capacity to compute true Capacity Utilization %
  const activeStaff = await Staff.find({
    businessId: new mongoose.Types.ObjectId(businessId),
    isActive: true
  });

  // Calculate shift minutes per day for active staff
  let dailyShiftMinutes = 0;
  for (const member of activeStaff) {
    for (const day of member.weeklySchedule || []) {
      if (day.isWorking && day.shiftStart && day.shiftEnd) {
        const [startH, startM] = day.shiftStart.split(':').map(Number);
        const [endH, endM] = day.shiftEnd.split(':').map(Number);
        const shiftDuration = (endH * 60 + endM) - (startH * 60 + startM);
        if (shiftDuration > 0) {
          dailyShiftMinutes += shiftDuration / 7; // Average daily shift minutes
        }
      }
    }
  }

  const daysDifference = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 86400000));
  const totalCapacityMinutes = Math.max(60, Math.round(dailyShiftMinutes * daysDifference));

  const capacityUtilizationPercentage =
    totalCapacityMinutes > 0
      ? Math.min(100, Number(((summary.bookedMinutes / totalCapacityMinutes) * 100).toFixed(1)))
      : 0;

  return {
    window: {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      daysCount: daysDifference
    },
    metrics: {
      ...summary,
      cancellationRate,
      capacityUtilizationPercentage,
      totalCapacityMinutes
    },
    bySource: metricsResult?.bySource || [],
    byStaff: metricsResult?.byStaff || []
  };
}
