const url =
  'https://wabi-west-europe-b-primary-api.analysis.windows.net/public/reports/querydata?synchronous=true';

function sourceRef(source) {
  return { SourceRef: { Source: source } };
}

function column(source, property) {
  return { Expression: sourceRef(source), Property: property };
}

function measure(source, property) {
  return { Measure: { Expression: sourceRef(source), Property: property } };
}

function filter(source, property, value) {
  return {
    Condition: {
      In: {
        Expressions: [{ Column: column(source, property) }],
        Values: [[{ Literal: { Value: `'${value.replaceAll("'", "''")}'` } }]],
      },
    },
  };
}

function excludeCityFilter(city) {
  const cityFilter = filter('p', 'Населений пункт_', city);

  return {
    Condition: {
      Not: {
        Expression: { In: cityFilter.Condition.In },
      },
    },
  };
}

const createCommand = (territory, drug, excludedCity) => ({
  Query: {
    Version: 2,
    From: [
      { Name: 'p', Entity: 'pharmacy_contract_divisions', Type: 0 },
      { Name: 'd', Entity: 'DAX', Type: 0 },
      { Name: 'l', Entity: 'last_date_dispence', Type: 0 },
    ],
    Select: [
      ...[
        'Аптечний заклад',
        'Назва відділення',
        'Телефон',
        'Адреса відділення',
      ].map((property) => ({
        Column: column('p', property),
        Name: `pharmacy_contract_divisions.${property}`,
      })),
      { ...measure('d', 'packets'), Name: 'DAX.packets' },
      { ...measure('d', 'cnt_dispensed'), Name: 'DAX.cnt_dispensed' },
      { ...measure('l', 'max_date'), Name: 'last_date_dispence.max_date' },
      { ...measure('d', 'website'), Name: 'DAX.website' },
      {
        Aggregation: {
          Expression: { Column: column('l', 'Останній погашений рецепт') },
          Function: 4,
        },
        Name: 'Max(last_date_dispence.Останній погашений рецепт)',
      },
    ],
    Where: [
      filter('p', territory.field, territory.value),
      filter('l', 'innms_name', drug),
      ...(excludedCity ? [excludeCityFilter(excludedCity)] : []),
    ],
    OrderBy: [{ Direction: 2, Expression: measure('d', 'cnt_dispensed') }],
  },
  Binding: {
    Primary: { Groupings: [{ Projections: [0, 1, 2, 3, 4, 5, 6, 7, 8] }] },
    DataReduction: { DataVolume: 3, Primary: { Window: { Count: 500 } } },
    SuppressedJoinPredicates: [7, 8],
    Version: 1,
  },
  ExecutionMetricsKind: 1,
});

const createBody = (command, visualId) => ({
  version: '1.0.0',
  modelId: 2821948,
  cancelQueries: [],
  queries: [
    {
      Query: {
        Commands: [{ SemanticQueryDataShapeCommand: command }],
      },
      QueryId: '',
      ApplicationContext: {
        DatasetId: '575c42b6-59f2-4899-a841-aadcd7e790b5',
        Sources: [
          {
            ReportId: '8d26c5ae-d2db-4046-a579-d2cf8b356f12',
            VisualId: visualId,
          },
        ],
      },
    },
  ],
});

function decodeRows(dataset) {
  const records = (dataset.PH ?? []).flatMap((group) => group.DM0 ?? []);
  let schema = [];
  let previous = [];

  return records.map((record) => {
    schema = record.S ?? schema;
    let cursor = 0;

    const row = schema.map((field, index) => {
      const bit = 1 << index;

      if ((record['Ø'] ?? 0) & bit) return null;
      if ((record.R ?? 0) & bit) return previous[index];

      const raw = Array.isArray(record.C)
        ? record.C[cursor++]
        : record[field.N];

      if (field.DN && Number.isInteger(raw)) {
        return dataset.ValueDicts[field.DN][raw];
      }

      return raw ?? null;
    });

    previous = row;
    return row;
  });
}

async function requestPowerBi(body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-PowerBI-ResourceKey': 'df6caff4-2e25-44e3-930c-81f7c38a6399',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`Power BI повернув HTTP ${response.status}`);
  }

  const json = await response.json();
  const dataset = json.results?.[0]?.result?.data?.dsr?.DS?.[0];

  if (!dataset) {
    throw new Error('Power BI не повернув набір даних');
  }

  return dataset;
}

async function getPharmacies(territory, drug, limit, excludedCity) {
  const command = createCommand(territory, drug, excludedCity);
  const dataset = await requestPowerBi(createBody(command, '86e21b5ac17ac63d0277'));

  return decodeRows(dataset)
    .filter((row) => row[0] != null || row[3] != null)
    .slice(0, limit)
    .map((row, index) => {
      const [company, name, phone, address, programs, count, lastDispensedAt] = row;

      // Power BI повертає код і назву закладу одним рядком.
      const companyText = company ?? '';
      const commaIndex = companyText.indexOf(',');

      return {
        number: index + 1,
        companyCode: commaIndex === -1 ? null : companyText.slice(0, commaIndex).trim(),
        companyName: commaIndex === -1 ? companyText : companyText.slice(commaIndex + 1).trim(),
        name: name ?? companyText,
        address,
        count,
        lastDispensedAt,
        phone,
        programs,
      };
    });
}

async function getSuggestions(term, { source, entity, property, visualId }) {
  const field = { Column: column(source, property) };
  const searchValue = `'${term.replaceAll("'", "''")}'`;

  const command = {
    Query: {
      Version: 2,
      From: [{ Name: source, Entity: entity, Type: 0 }],
      Select: [{
        ...field,
        Name: `${entity}.${property}`,
        NativeReferenceName: property,
      }],
      Where: [
        {
          Condition: {
            Not: {
              Expression: {
                Comparison: {
                  ComparisonKind: 0,
                  Left: field,
                  Right: { Literal: { Value: 'null' } },
                },
              },
            },
          },
        },
        {
          Condition: {
            Contains: {
              Left: field,
              Right: { Literal: { Value: searchValue } },
            },
          },
        },
      ],
    },
    Binding: {
      Primary: { Groupings: [{ Projections: [0] }] },
      DataReduction: { DataVolume: 3, Primary: { Window: { Count: 15 } } },
      IncludeEmptyGroups: true,
      Version: 1,
    },
    ExecutionMetricsKind: 1,
  };

  const dataset = await requestPowerBi(createBody(command, visualId));
  const names = decodeRows(dataset)
    .map(([name]) => name)
    .filter((name) => typeof name === 'string' && name.length > 0);

  return [...new Set(names)].slice(0, 15);
}

function getDrugSuggestions(term) {
  return getSuggestions(term, {
    source: 'l',
    entity: 'last_date_dispence',
    property: 'innms_name',
    visualId: '4462c2fe862e417240d8',
  });
}

function getCitySuggestions(term) {
  return getSuggestions(term, {
    source: 'p',
    entity: 'pharmacy_contract_divisions',
    property: 'Населений пункт_',
    visualId: '86e21b5ac17ac63d0277',
  });
}

module.exports = { getPharmacies, getDrugSuggestions, getCitySuggestions };
