import { VisualizationSuggestionScore, type VisualizationSuggestionsSupplier } from '@grafana/data';
import { type GraphFieldConfig } from '@grafana/ui';
import { getGeometryField, getDefaultLocationMatchers } from 'app/features/geo/utils/location';

import { defaultMarkersConfig } from './layers/data/markersLayer';
import { type Options } from './panelcfg.gen';

/**
 * GeomapPanel injects defaultMarkersConfig (showLegend: true) when layers is missing.
 * Suggestion cards ship empty options, so previewModifier must provide a layer with
 * the legend already off — mutating a missing layers array is a no-op.
 */
export function applyPreviewLayerLegendDefaults(options: Partial<Options>) {
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

  for (const layer of options.layers) {
    layer.config = {
      ...(layer.config ?? {}),
      showLegend: false,
    };
  }
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
          s.options ??= {};
          s.options.controls = {
            showZoom: false,
            showScale: false,
            showAttribution: false,
            showMeasure: false,
          };
          applyPreviewLayerLegendDefaults(s.options);
        },
      },
    },
  ];
};
