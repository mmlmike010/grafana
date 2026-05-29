import {
  createDataFrame,
  FieldType,
  getPanelDataSummary,
  type VisualizationSuggestion,
  VisualizationSuggestionScore,
} from '@grafana/data';
import { type GraphFieldConfig } from '@grafana/ui';

import { type Options } from './panelcfg.gen';
import { geomapSuggestionsSupplier } from './suggestions';

describe('geomap suggestions', () => {
  const locationSummary = getPanelDataSummary([
    createDataFrame({
      fields: [
        { name: 'latitude', type: FieldType.number, values: [10, 20] },
        { name: 'longitude', type: FieldType.number, values: [30, 40] },
        { name: 'value', type: FieldType.number, values: [1, 2] },
      ],
    }),
  ]);

  it('suggests Geomap when data has location fields', () => {
    const suggestions = geomapSuggestionsSupplier(locationSummary);

    expect(suggestions).toHaveLength(1);
    expect(suggestions?.[0].score).toBe(VisualizationSuggestionScore.Best);
  });

  it('creates a legend-free marker layer for preview cards without configured layers', () => {
    const suggestion = geomapSuggestionsSupplier(locationSummary)![0];
    const preview = { ...suggestion } as VisualizationSuggestion<Options, GraphFieldConfig>;

    suggestion.cardOptions!.previewModifier!(preview);

    expect(preview.options?.controls).toMatchObject({
      showZoom: false,
      showScale: false,
      showAttribution: false,
      showMeasure: false,
    });
    expect(preview.options?.layers).toEqual([
      {
        type: 'markers',
        name: '',
        config: {
          showLegend: false,
        },
      },
    ]);
  });

  it('hides legends on existing preview layers', () => {
    const suggestion = geomapSuggestionsSupplier(locationSummary)![0];
    const preview = {
      ...suggestion,
      options: {
        layers: [
          {
            type: 'markers',
            name: 'Configured markers',
            config: {
              showLegend: true,
              customValue: 'preserved',
            },
          },
        ],
      },
    } as VisualizationSuggestion<Options, GraphFieldConfig>;

    suggestion.cardOptions!.previewModifier!(preview);

    expect(preview.options?.layers?.[0]).toEqual({
      type: 'markers',
      name: 'Configured markers',
      config: {
        showLegend: false,
        customValue: 'preserved',
      },
    });
  });
});
