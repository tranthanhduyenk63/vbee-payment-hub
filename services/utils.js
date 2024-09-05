/* eslint-disable */
const getDateQuery = (dateField, startDate, endDate) => {
  if (startDate && endDate) {
    return {
      [dateField]: { $gte: new Date(startDate), $lte: new Date(endDate) },
    };
  }

  if (startDate && !endDate) {
    return {
      [dateField]: { $gte: new Date(startDate) },
    };
  }

  if (!startDate && endDate) {
    return {
      [dateField]: { $lte: new Date(endDate) },
    };
  }

  return {};
};

/**
 * @param {string} sort "createdAt_desc,name_asc"
 * @return {Object} { createdAt: -1, name: 1 }
 */
const getSortQuery = (sort) => {
  const sortQuery = {};
  sort.split(',').forEach((sortItem) => {
    const [field, direction] = sortItem.split('_');
    sortQuery[field] = direction === 'desc' ? -1 : 1;
  });
  return sortQuery;
};

const getSelectQuery = (fields) => {
  const selectQuery = {};
  fields.split(',').forEach((field) => {
    switch (field) {
      case 'partnerName':
        selectQuery['partner.name'] = 1;
        break;
      case 'providerName':
        selectQuery['provider.name'] = 1;
        break;
      case 'channelName':
        selectQuery['channel.name'] = 1;
        break;
      default:
        selectQuery[field] = 1;
    }
  });

  return selectQuery;
};

const getSearchQuery = (model, searchFields, search) =>
  searchFields
    .filter(
      (field) =>
        !(
          model.schema.paths[field].instance === 'Number' &&
          // eslint-disable-next-line no-restricted-globals
          isNaN(parseInt(search, 10))
        ),
    )
    .map((field) =>
      model.schema.paths[field].instance === 'Number'
        ? { [field]: parseInt(search, 10) }
        : { [field]: new RegExp(search, 'gi') },
    );

module.exports = { getDateQuery, getSortQuery, getSelectQuery, getSearchQuery };
