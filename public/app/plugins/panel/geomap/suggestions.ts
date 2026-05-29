import { VisualizationSuggestionScore, type VisualizationSuggestionsSupplier } from '@grafana/data';
import { type GraphFieldConfig } from '@grafana/ui';
import { getGeometryField, getDefaultLocationMatchers } from 'app/features/geo/utils/location';

import { type Options } from './panelcfg.gen';

const getPreviewLayerOptions = () => ({
  type: 'markers',
  name: '',
  config: {
    showLegend: false,
  },
});

export const geomapSuggestionsSupplier: VisualizationSuggestionsSupplier<Options, GraphFieldConfig> = (dataSummary) => {
  if (!dataSummary.hasData || !dataSummary.rawFrames) {
    return;
  }

  // use getGeometryField to see if any frames have geolocation info
  const location = getDefaultLocationMatchers();
  if (!dataSummary.rawFrames.some((frame) => !getGeometryField(frame, location).warning)) {
    return;
  }

  return [
    {
      score: VisualizationSuggestionScore.Best,
      fieldConfig: {
        defaults: {
          custom: {},
        },
        overrides: [],
      },
      cardOptions: {
        previewModifier: (s) => {
          s.options = s.options ?? {};
          s.options.controls = {
            ...s.options.controls,
            showZoom: false,
            showScale: false,
            showAttribution: false,
            showMeasure: false,
          };

          s.options.layers = s.options.layers?.length ? s.options.layers : [getPreviewLayerOptions()];
          s.options.layers.forEach((layer) => {
            layer.config = layer.config || {};
            layer.config.showLegend = false;
          });
        },
      },
    },
  ];
};
