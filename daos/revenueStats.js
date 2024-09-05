const RevenueStats = require('../model/revenueStats');

const createRevenueStats = async (data) => {
  const revenueStats = await RevenueStats.create(data);
  return revenueStats;
};

const deleteManyRevenueStats = async (condition) => {
  const result = await RevenueStats.deleteMany(condition);
  return result;
};

module.exports = { createRevenueStats, deleteManyRevenueStats };
