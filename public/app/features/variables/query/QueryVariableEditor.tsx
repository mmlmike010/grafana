import { type FormEvent, memo, useEffect, useRef } from 'react';

import {
  type DataSourceInstanceSettings,
  getDataSourceRef,
  type QueryVariableModel,
  type SelectableValue,
  type VariableRefresh,
  type VariableSort,
} from '@grafana/data';
import { QueryVariableEditorForm } from 'app/features/dashboard-scene/settings/variables/components/QueryVariableForm';
import { type StoreState, useDispatch, useSelector } from 'app/types/store';

import { getTimeSrv } from '../../dashboard/services/TimeSrv';
import { initialVariableEditorState } from '../editor/reducer';
import { getQueryVariableEditorState } from '../editor/selectors';
import { type VariableEditorProps } from '../editor/types';
import { getVariablesState } from '../state/selectors';
import { toKeyedVariableIdentifier } from '../utils';

import { changeQueryVariableDataSource, changeQueryVariableQuery, initQueryVariableEditor } from './actions';

export interface OwnProps extends VariableEditorProps<QueryVariableModel> {}

export const QueryVariableEditor = memo(function QueryVariableEditor({ variable, onPropChange }: OwnProps) {
  const dispatch = useDispatch();
  const prevDatasourceRef = useRef<typeof variable.datasource | 'init'>('init');

  const extended = useSelector((state: StoreState) => {
    const { rootStateKey } = variable;
    if (!rootStateKey) {
      console.error('QueryVariableEditor: variable has no rootStateKey');
      return getQueryVariableEditorState(initialVariableEditorState);
    }

    const { editor } = getVariablesState(rootStateKey, state);

    return getQueryVariableEditorState(editor);
  });

  useEffect(() => {
    prevDatasourceRef.current = 'init';
    void dispatch(initQueryVariableEditor(toKeyedVariableIdentifier(variable)));
    // Match legacy componentDidMount: init when variable identity (id/root/type) changes only.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- full variable in deps would re-init on every prop edit
  }, [dispatch, variable.id, variable.rootStateKey, variable.type]);

  useEffect(() => {
    if (prevDatasourceRef.current === 'init') {
      prevDatasourceRef.current = variable.datasource;
      return;
    }
    if (prevDatasourceRef.current !== variable.datasource) {
      prevDatasourceRef.current = variable.datasource;
      void dispatch(
        changeQueryVariableDataSource(toKeyedVariableIdentifier(variable), variable.datasource)
      );
    }
    // Match legacy componentDidUpdate: react to datasource ref change only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, variable.datasource, variable.id, variable.rootStateKey]);

  const onDataSourceChange = (dsSettings: DataSourceInstanceSettings) => {
    onPropChange({
      propName: 'datasource',
      propValue: dsSettings.isDefault ? null : getDataSourceRef(dsSettings),
    });
  };

  const onLegacyQueryChange = async (query: any, definition: string) => {
    if (variable.query !== query) {
      dispatch(changeQueryVariableQuery(toKeyedVariableIdentifier(variable), query, definition));
    }
  };

  const onQueryChange = async (query: any) => {
    if (variable.query !== query) {
      let definition = '';

      if (query && query.hasOwnProperty('query') && typeof query.query === 'string') {
        definition = query.query;
      }

      dispatch(changeQueryVariableQuery(toKeyedVariableIdentifier(variable), query, definition));
    }
  };

  const onRegExBlur = async (event: FormEvent<HTMLTextAreaElement>) => {
    const regex = event.currentTarget.value;
    if (variable.regex !== regex) {
      onPropChange({ propName: 'regex', propValue: regex, updateOptions: true });
    }
  };

  const onRefreshChange = (option: VariableRefresh) => {
    onPropChange({ propName: 'refresh', propValue: option });
  };

  const onSortChange = async (option: SelectableValue<VariableSort>) => {
    onPropChange({ propName: 'sort', propValue: option.value, updateOptions: true });
  };

  const onMultiChange = (event: FormEvent<HTMLInputElement>) => {
    onPropChange({ propName: 'multi', propValue: event.currentTarget.checked });
  };

  const onIncludeAllChange = (event: FormEvent<HTMLInputElement>) => {
    onPropChange({ propName: 'includeAll', propValue: event.currentTarget.checked });
  };

  const onAllValueChange = (event: FormEvent<HTMLInputElement>) => {
    onPropChange({ propName: 'allValue', propValue: event.currentTarget.value });
  };

  if (!extended || !extended.dataSource) {
    return null;
  }

  const timeRange = getTimeSrv().timeRange();

  return (
    <QueryVariableEditorForm
      datasource={variable.datasource ?? undefined}
      onDataSourceChange={onDataSourceChange}
      query={variable.query}
      onQueryChange={onQueryChange}
      onLegacyQueryChange={onLegacyQueryChange}
      timeRange={timeRange}
      regex={variable.regex}
      onRegExChange={onRegExBlur}
      sort={variable.sort}
      onSortChange={onSortChange}
      refresh={variable.refresh}
      onRefreshChange={onRefreshChange}
      isMulti={variable.multi}
      includeAll={variable.includeAll}
      allValue={variable.allValue ?? ''}
      onMultiChange={onMultiChange}
      onIncludeAllChange={onIncludeAllChange}
      onAllValueChange={onAllValueChange}
      options={variable.options.map((o) => ({
        label: String(o.text),
        value: String(o.value),
        properties: o.properties,
      }))}
    />
  );
});
