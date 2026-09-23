import { createDataFrame, FieldType, getPanelDataSummary, VisualizationSuggestionScore } from '@grafana/data';

import { defaultMarkersConfig } from './layers/data/markersLayer';
import { type Options } from './panelcfg.gen';
import { applyPreviewLayerLegendDefaults, geomapSuggestionsSupplier } from './suggestions';

function geoDataSummary() {
  return getPanelDataSummary([
    createDataFrame({
      fields: [
        { name: 'lat', type: FieldType.number, values: [37.77, 40.71] },
        { name: 'lon', type: FieldType.number, values: [-122.42, -74.01] },
        { name: 'value', type: FieldType.number, values: [1, 2] },
      ],
    }),
  ]);
}

describe('geomap suggestions', () => {
  describe('supplier', () => {
    it('returns nothing when there is no data', () => {
      expect(geomapSuggestionsSupplier(getPanelDataSummary([]))).toBeUndefined();
    });

    it('returns nothing when frames have no geolocation fields', () => {
      const dataSummary = getPanelDataSummary([
        createDataFrame({
          fields: [
            { name: 'time', type: FieldType.time, values: [1, 2] },
            { name: 'value', type: FieldType.number, values: [10, 20] },
          ],
        }),
      ]);

      expect(geomapSuggestionsSupplier(dataSummary)).toBeUndefined();
    });

    it('suggests geomap as Best when frames include lat/lon', () => {
      const result = geomapSuggestionsSupplier(geoDataSummary());

      expect(result).toHaveLength(1);
      expect(result![0].score).toBe(VisualizationSuggestionScore.Best);
      expect(result![0].cardOptions?.previewModifier).toBeDefined();
    });
  });

  describe('previewModifier', () => {
    it('hides map controls and supplies a markers layer with the legend off when options have no layers', () => {
      const result = geomapSuggestionsSupplier(geoDataSummary())!;
      const suggestion = { ...result[0], options: {} as Partial<Options> };

      result[0].cardOptions!.previewModifier!(suggestion);

      expect(suggestion.options!.controls).toEqual({
        showZoom: false,
        showScale: false,
        showAttribution: false,
        showMeasure: false,
      });
      expect(suggestion.options!.layers).toHaveLength(1);
      expect(suggestion.options!.layers![0].type).toBe(defaultMarkersConfig.type);
      expect(suggestion.options!.layers![0].config).toEqual(
        expect.objectContaining({
          showLegend: false,
        })
      );
    });

    it('does not mutate the shared default markers config', () => {
      const result = geomapSuggestionsSupplier(geoDataSummary())!;
      const suggestion = { ...result[0], options: {} as Partial<Options> };

      result[0].cardOptions!.previewModifier!(suggestion);

      expect(defaultMarkersConfig.config?.showLegend).toBe(true);
    });

    it('merges showLegend: false into existing layers without dropping other config', () => {
      const result = geomapSuggestionsSupplier(geoDataSummary())!;
      const suggestion = {
        ...result[0],
        options: {
          layers: [
            { type: 'markers', name: 'Points', config: { showLegend: true, style: { size: { fixed: 8 } } } },
            { type: 'network', name: 'Links' },
          ],
        } as Partial<Options>,
      };

      result[0].cardOptions!.previewModifier!(suggestion);

      expect(suggestion.options!.layers![0].config).toEqual({
        showLegend: false,
        style: { size: { fixed: 8 } },
      });
      expect(suggestion.options!.layers![1].config).toEqual({ showLegend: false });
    });
  });

  describe('applyPreviewLayerLegendDefaults', () => {
    it('replaces an empty layers array with a legend-hidden markers layer', () => {
      const options: Partial<Options> = { layers: [] };

      applyPreviewLayerLegendDefaults(options);

      expect(options.layers).toHaveLength(1);
      expect(options.layers![0].config).toEqual(
        expect.objectContaining({
          showLegend: false,
        })
      );
    });
  });
});
