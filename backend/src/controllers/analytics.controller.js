import { computeBusinessAnalytics } from '../services/analytics.service.js';

export async function getAnalyticsOverview(req, res, next) {
  try {
    const { startDate, endDate } = req.query;

    const data = await computeBusinessAnalytics({
      businessId: req.business._id,
      startDate: startDate ? new Date(String(startDate)) : undefined,
      endDate: endDate ? new Date(String(endDate)) : undefined
    });

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
}
