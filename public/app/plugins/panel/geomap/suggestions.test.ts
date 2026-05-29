import { createDataFrame, FieldType, getPanelDataSummary } from '@grafana/data';

import { defaultMarkersConfig } from './layers/data/markersLayer';
import { geomapSuggestionsSupplier } from './suggestions';

describe('geomapSuggestionsSupplier', () => {
  const geoDataSummary = getPanelDataSummary([
    createDataFrame({
      fields: [
        { name: 'latitude', type: FieldType.number, values: [40.7] },
        { name: 'longitude', type: FieldType.number, values: [-74.1] },
        { name: 'value', type: FieldType.number, values: [1] },
      ],
    }),
  ]);

  const nonGeoDataSummary = getPanelDataSummary([
    createDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, values: [1] },
        { name: 'value', type: FieldType.number, values: [10] },
      ],
    }),
  ]);

  it('returns a suggestion when frames have location fields', () => {
    expect(geomapSuggestionsSupplier(geoDataSummary)).toHaveLength(1);
  });

  it('returns undefined when frames have no location fields', () => {
    expect(geomapSuggestionsSupplier(nonGeoDataSummary)).toBeUndefined();
  });

  describe('previewModifier', () => {
    it('adds layers with legends disabled when options.layers is missing', () => {
      const suggestion = geomapSuggestionsSupplier(geoDataSummary)![0];
      const preview = { ...suggestion, options: {} };
      suggestion.cardOptions!.previewModifier!(preview);

      expect(preview.options!.controls?.showZoom).toBe(false);
      expect(preview.options!.layers).toHaveLength(1);
      expect(preview.options!.layers![0].config?.showLegend).toBe(false);
    });

    it('disables legends on existing layers', () => {
      const suggestion = geomapSuggestionsSupplier(geoDataSummary)![0];
      const preview = {
        ...suggestion,
        options: {
          layers: [{ ...defaultMarkersConfig, config: { showLegend: true } }],
        },
      };
      suggestion.cardOptions!.previewModifier!(preview);

      expect(preview.options!.layers![0].config?.showLegend).toBe(false);
    });
  });
});
