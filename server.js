const express = require('express');
const path = require('node:path');
const { cities, regions, drugs, regionCenters } = require('./catalog');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use('/assets/fonts', express.static(path.join(__dirname, 'assets', 'fonts')));
app.use('/assets/img', express.static(path.join(__dirname, 'assets', 'img')));

const { getPharmacies } = require('./powerbi');

app.get('/api/pharmacies', async (req, res) => {

  const { city, region, customCity } = req.query;

  const supplied = [city, region, customCity].filter(
    (value) => value !== undefined,
  );

  if (supplied.length !== 1 || typeof supplied[0] !== 'string') {
    return res.status(400).json({
      error: 'Вибери місто, область або введи назву населеного пункту',
    });
  }

  const customName = customCity?.trim();

  if (customCity !== undefined && (!customName || customName.length > 100)) {
    return res.status(400).json({ error: 'Введи назву від 1 до 100 символів' });
  }

  const territory = region !== undefined
    ? { field: 'Область', value: regions.get(region) }
    : { field: 'Населений пункт_', value: customName ?? cities.get(city) };

  if (!territory.value) {
    return res.status(400).json({ error: 'Невідоме місто або область' });
  }

  const drugId = req.query.drug ?? 'lercanidipine';
  const drug = drugs.get(drugId);
  if (!drug) {
    return res.status(400).json({ error: 'Невідомий препарат' });
  }

  const limitParam = req.query.limit ?? '250';
  if (!['25', '50', '75', '100', '250', '500'].includes(limitParam)) {
    return res.status(400).json({ error: 'Невідома кількість рядків' });
  }
  const limit = Number(limitParam);

  const shouldExcludeCenter = region !== undefined && req.query.excludeCenter === '1';
  const excludedCity = shouldExcludeCenter
    ? cities.get(regionCenters.get(region))
    : undefined;
  if (shouldExcludeCenter && !excludedCity) {
    return res.status(500).json({ error: 'Для цієї області не задано обласний центр' });
  }

  try {
    const pharmacies = await getPharmacies(territory, drug, limit, excludedCity);
    res.json(pharmacies);
  } catch (error) {
    console.error(error);
    res.status(502).json({ error: 'Не вдалося отримати дані з Power BI' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Сервер працює на порту ${PORT}`);
});