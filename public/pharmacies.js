const button = document.querySelector('#load-pharmacies');
const status = document.querySelector('#status');
const tbody = document.querySelector('#pharmacy-rows');
const modeSelect = document.querySelector('#territory-mode');
const citySelect = document.querySelector('#city');
const customCityField = document.querySelector('#custom-city-field');
const customCityInput = document.querySelector('#custom-city');
const regionSelect = document.querySelector('#region');
const excludeCenterInput = document.querySelector('#exclude-center');
const cityField = document.querySelector('#city-field');
const regionField = document.querySelector('#region-field');
const drugSelect = document.querySelector('#drug');
const customDrugField = document.querySelector('#custom-drug-field');
const customDrugInput = document.querySelector('#custom-drug');
const limitSelect = document.querySelector('#limit');

function updateCustomCityField() {
  customCityField.hidden = citySelect.value !== 'custom';
}

citySelect.addEventListener('change', updateCustomCityField);
updateCustomCityField();

function updateTerritoryFields() {
  const isRegion = modeSelect.value === 'region';

  cityField.hidden = isRegion;
  regionField.hidden = !isRegion;
}

function updateCustomDrugField() {
  customDrugField.hidden = drugSelect.value !== 'custom';
}

drugSelect.addEventListener('change', updateCustomDrugField);
updateCustomDrugField();

modeSelect.addEventListener('change', updateTerritoryFields);
updateTerritoryFields();

const dateFormatter = new Intl.DateTimeFormat('uk-UA', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: 'UTC',
});

function formatDispensedDate(value) {
  if (value == null || value === '') return '—';

  // Power BI може повернути число в мілісекундах або дату рядком.
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return dateFormatter.format(date).replace(', ', ' ');
}

button.addEventListener('click', async () => {
  button.disabled = true;
  status.textContent = 'Завантаження…';

  try {
    const params = new URLSearchParams();

    if (modeSelect.value === 'region') {
      params.set('region', regionSelect.value);

      if (excludeCenterInput.checked) {
        params.set('excludeCenter', '1');
      }
    } else if (citySelect.value === 'custom') {
      const name = customCityInput.value.trim();

      if (!name) {
        status.textContent = 'Введи назву населеного пункту.';
        customCityInput.focus();
        return;
      }

      params.set('customCity', name);
    } else {
      params.set('city', citySelect.value);
    }

    params.set('drug', drugSelect.value);
    params.set('limit', limitSelect.value);

    if (drugSelect.value === 'custom') {
      const name = customDrugInput.value.trim();

      if (!name) {
        status.textContent = 'Введи назву лікарського засобу (МНН).';
        customDrugInput.focus();
        return;
      }

      params.set('customDrug', name);
    }

    const response = await fetch(`/api/pharmacies?${params}`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.error || `HTTP ${response.status}`);
    }

    const pharmacies = await response.json();
    const rows = pharmacies.map((pharmacy) => {
      const row = document.createElement('tr');
      const values = [
        // pharmacy.number,
        // pharmacy.companyCode,
        pharmacy.companyName,
        pharmacy.name,
        pharmacy.address,
        pharmacy.count,
        formatDispensedDate(pharmacy.lastDispensedAt),
        // pharmacy.phone,
        // pharmacy.programs,
      ];

      for (const [index, value] of values.entries()) {
        const cell = document.createElement('td');
        const hasValue = value != null && value !== '';
        const text = hasValue ? String(value) : '—';

        if (index < 3 && hasValue) {
          const button = document.createElement('button');
          const label = document.createElement('span');

          button.type = 'button';
          button.className = 'table-text-button';
          button.setAttribute('aria-expanded', 'false');

          label.className = 'table-text';
          label.textContent = text;

          button.append(label);
          cell.append(button);
        } else {
          cell.textContent = text;
        }

        row.append(cell);
      }

      row.addEventListener('click', () => {
        const expanded = row.classList.toggle('is-expanded');

        for (const text of row.querySelectorAll('.table-text')) {
          text.classList.toggle('table-text--expanded', expanded);
        }

        for (const button of row.querySelectorAll('.table-text-button')) {
          button.setAttribute('aria-expanded', String(expanded));
        }
      });

      return row;
    });

    tbody.replaceChildren(...rows);
    status.textContent = `Знайдено аптек: ${rows.length}`;
  } catch (error) {
    status.textContent = `Не вдалося завантажити аптеки (${error.message}).`;
  } finally {
    button.disabled = false;
  }
});
