import { VisualizationSuggestionScore, type VisualizationSuggestionsSupplier } from '@grafana/data';
import { type GraphFieldConfig } from '@grafana/ui';
import { getGeometryField, getDefaultLocationMatchers } from 'app/features/geo/utils/location';

import { defaultMarkersConfig } from './layers/data/markersLayer';
import { type Options } from './panelcfg.gen';

function hidePreviewLayerLegends(options: Partial<Options>) {
  // Suggestions omit layers, so GeomapPanel would otherwise inject
  // defaultMarkersConfig with showLegend: true and overlay the tiny preview.
  if (!options.layers?.length) {
    options.layers = [
      {
        ...defaultMarkersConfig,
        config: {
          ...defaultMarkersConfig.config,
          showLegend: false,
        },
      },
    ];
    return;
  }

  options.layers.forEach((layer) => {
    layer.config = { ...layer.config, showLegend: false };
  });
}

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
            showZoom: false,
            showScale: false,
            showAttribution: false,
            showMeasure: false,
          };
          hidePreviewLayerLegends(s.options);
        },
      },
    },
  ];
};
