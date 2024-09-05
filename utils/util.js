const getPercentString = (value, total) => {
  if (total === 0) return '0';
  const percent = (value / total) * 100;
  return percent.toLocaleString(undefined, { maximumFractionDigits: 1 });
};

const getSum = (values = []) => {
  const sum = values.reduce((total, curr) => total + curr, 0);
  return sum;
};

module.exports = { getPercentString, getSum };
