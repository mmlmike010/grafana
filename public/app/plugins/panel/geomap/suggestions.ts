import {
  type MapLayerOptions,
  VisualizationSuggestionScore,
  type VisualizationSuggestionsSupplier,
} from '@grafana/data';
import { type GraphFieldConfig } from '@grafana/ui';
import { getGeometryField, getDefaultLocationMatchers } from 'app/features/geo/utils/location';

import { defaultMarkersConfig } from './layers/data/markersLayer';
import { type Options } from './panelcfg.gen';

/** Preview-only layer config: GeomapPanel adds defaultMarkersConfig when layers is empty. */
function layerWithoutLegend(layer: MapLayerOptions): MapLayerOptions {
  return {
    ...layer,
    config: {
      ...(layer.config ?? {}),
      showLegend: false,
    },
  };
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
          // GeomapPanel injects defaultMarkersConfig when layers is missing; set layers here so
          // preview renders without the layer legend that would cover the tiny thumbnail.
          if (!s.options.layers?.length) {
            s.options.layers = [layerWithoutLegend(defaultMarkersConfig)];
          } else {
            s.options.layers = s.options.layers.map(layerWithoutLegend);
          }
        },
      },
    },
  ];
};
