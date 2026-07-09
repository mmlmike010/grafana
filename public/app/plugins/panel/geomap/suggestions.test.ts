import { createDataFrame, FieldType, getPanelDataSummary, VisualizationSuggestionScore } from '@grafana/data';

import { MARKERS_LAYER_ID } from './layers/data/markersLayer';
import { type Options } from './panelcfg.gen';
import { geomapSuggestionsSupplier } from './suggestions';

describe('geomap panel suggestions', () => {
  describe('early return conditions', () => {
    it('should not suggest geomap when there is no data', () => {
      const dataSummary = getPanelDataSummary([]);
      expect(geomapSuggestionsSupplier(dataSummary)).toBeUndefined();
    });

    it('should not suggest geomap when frames lack geolocation fields', () => {
      const dataSummary = getPanelDataSummary([
        createDataFrame({
          fields: [
            { name: 'time', type: FieldType.time, values: [1, 2, 3] },
            { name: 'value', type: FieldType.number, values: [10, 20, 30] },
          ],
        }),
      ]);
      expect(geomapSuggestionsSupplier(dataSummary)).toBeUndefined();
    });
  });

  describe('with geo data', () => {
    const summary = getPanelDataSummary([
      createDataFrame({
        fields: [
          { name: 'lat', type: FieldType.number, values: [40.7, 34.0] },
          { name: 'lon', type: FieldType.number, values: [-74.0, -118.2] },
          { name: 'value', type: FieldType.number, values: [1, 2] },
        ],
      }),
    ]);

    it('should suggest geomap with Best score', () => {
      const result = geomapSuggestionsSupplier(summary)!;
      expect(result).toHaveLength(1);
      expect(result[0].score).toBe(VisualizationSuggestionScore.Best);
    });

    describe('previewModifier', () => {
      it('seeds a markers layer with showLegend false when layers are missing', () => {
        const result = geomapSuggestionsSupplier(summary)!;
        const suggestion = { ...result[0], options: {} as Partial<Options> };

        result[0].cardOptions!.previewModifier!(suggestion);

        expect(suggestion.options!.layers).toHaveLength(1);
        expect(suggestion.options!.layers![0].type).toBe(MARKERS_LAYER_ID);
        expect(suggestion.options!.layers![0].config?.showLegend).toBe(false);
      });

      it('sets showLegend false on existing layers', () => {
        const result = geomapSuggestionsSupplier(summary)!;
        const suggestion = {
          ...result[0],
          options: {
            layers: [
              {
                type: MARKERS_LAYER_ID,
                name: 'Markers',
                config: { showLegend: true },
              },
            ],
          } as Partial<Options>,
        };

        result[0].cardOptions!.previewModifier!(suggestion);

        expect(suggestion.options!.layers![0].config?.showLegend).toBe(false);
      });

      it('hides map controls in the preview', () => {
        const result = geomapSuggestionsSupplier(summary)!;
        const suggestion = { ...result[0], options: {} as Partial<Options> };

        result[0].cardOptions!.previewModifier!(suggestion);

        expect(suggestion.options!.controls).toEqual({
          showZoom: false,
          showScale: false,
          showAttribution: false,
          showMeasure: false,
        });
      });
    });
  });
});
