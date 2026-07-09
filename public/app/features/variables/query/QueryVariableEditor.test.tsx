import { configureStore } from '@reduxjs/toolkit';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MockDataSourceApi } from 'test/mocks/datasource_srv';

import { type QueryVariableModel, VariableSupportType } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { mockDataSource } from 'app/features/alerting/unified/mocks';
import { DataSourceType } from 'app/features/alerting/unified/utils/datasource';

import { NEW_VARIABLE_ID } from '../constants';
import { LegacyVariableQueryEditor } from '../editor/LegacyVariableQueryEditor';
import { getPreloadedState, getRootReducer, type RootReducerType } from '../state/helpers';
import { type KeyedVariableIdentifier } from '../state/types';

import { QueryVariableEditor } from './QueryVariableEditor';
import * as queryActions from './actions';
import { initialQueryVariableModelState } from './reducer';

jest.spyOn(queryActions, 'initQueryVariableEditor');
jest.spyOn(queryActions, 'changeQueryVariableQuery');

const mockDS = mockDataSource({
  name: 'CloudManager',
  type: DataSourceType.Alertmanager,
});
const ds = new MockDataSourceApi(mockDS);
const editor = jest.fn().mockImplementation(LegacyVariableQueryEditor);

ds.variables = {
  getType: () => VariableSupportType.Custom,
  query: jest.fn(),
  editor: editor,
  getDefaultQuery: jest.fn(),
};

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => ({
    get: async () => ds,
    getList: () => [mockDS],
    getInstanceSettings: () => mockDS,
  }),
}));

const defaultIdentifier: KeyedVariableIdentifier = { type: 'query', rootStateKey: 'key', id: NEW_VARIABLE_ID };

const setupTestContext = async (options: { variable?: Partial<QueryVariableModel>; onPropChange?: jest.Mock }) => {
  const variableDefaults: Partial<QueryVariableModel> = {
    rootStateKey: 'key',
    datasource: { uid: 'uid', type: 'type' },
  };

  const variable: QueryVariableModel = {
    ...initialQueryVariableModelState,
    ...variableDefaults,
    ...options.variable,
  };

  const onPropChange = options.onPropChange ?? jest.fn();

  const templatingState = {
    variables: {
      [variable.id]: { ...variable },
    },
    editor: {
      id: '',
      isValid: true,
      errors: {},
      name: '',
      extended: {
        VariableQueryEditor: LegacyVariableQueryEditor,
        dataSource: ds,
      },
    },
  };

  const store = configureStore({
    reducer: getRootReducer(),
    preloadedState: getPreloadedState('key', templatingState) as unknown as RootReducerType,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({ thunk: true, serializableCheck: false, immutableCheck: false }),
  });

  const { rerender } = await act(() =>
    render(
      <Provider store={store}>
        <QueryVariableEditor variable={variable} onPropChange={onPropChange} />
      </Provider>
    )
  );

  return { rerender, store, onPropChange, variable };
};

describe('QueryVariableEditor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('when the component is mounted', () => {
    it('then it should call initQueryVariableEditor', async () => {
      await setupTestContext({});

      expect(queryActions.initQueryVariableEditor).toHaveBeenCalledTimes(1);
      expect(queryActions.initQueryVariableEditor).toHaveBeenCalledWith(defaultIdentifier);
    });
  });

  describe('when the editor is rendered', () => {
    it('should pass down the query with default values if the datasource config defines it', async () => {
      await setupTestContext({});
      expect(ds.variables?.getDefaultQuery).toBeDefined();
      expect(ds.variables?.getDefaultQuery).toHaveBeenCalledTimes(2);
    });
  });

  describe('when the user changes', () => {
    it.each`
      fieldName  | propName                      | expectedArgs
      ${'query'} | ${'changeQueryVariableQuery'} | ${[defaultIdentifier, 't', '']}
      ${'regex'} | ${'onPropChange'}             | ${[{ propName: 'regex', propValue: 't', updateOptions: true }]}
    `(
      '$fieldName field and tabs away then $propName should be called with correct args',
      async ({ fieldName, propName, expectedArgs }) => {
        const onPropChange = jest.fn();
        await setupTestContext({ onPropChange });
        const fieldAccessor = fieldAccessors[fieldName];

        await userEvent.type(fieldAccessor(), 't');
        await userEvent.tab();

        if (propName === 'changeQueryVariableQuery') {
          expect(queryActions.changeQueryVariableQuery).toHaveBeenCalledTimes(1);
          expect(queryActions.changeQueryVariableQuery).toHaveBeenCalledWith(...expectedArgs);
        } else {
          expect(onPropChange).toHaveBeenCalledTimes(1);
          expect(onPropChange).toHaveBeenCalledWith(...expectedArgs);
        }
      }
    );
  });

  describe('when the user changes', () => {
    it.each`
      fieldName  | propName
      ${'query'} | ${'changeQueryVariableQuery'}
      ${'regex'} | ${'onPropChange'}
    `(
      '$fieldName field but reverts the change and tabs away then $propName should not be called',
      async ({ fieldName, propName }) => {
        const onPropChange = jest.fn();
        await setupTestContext({ onPropChange });
        const fieldAccessor = fieldAccessors[fieldName];

        await userEvent.type(fieldAccessor(), 't');
        await userEvent.type(fieldAccessor(), '{backspace}');
        await userEvent.tab();

        if (propName === 'onPropChange') {
          expect(onPropChange).not.toHaveBeenCalled();
        } else {
          expect(queryActions.changeQueryVariableQuery).not.toHaveBeenCalled();
        }
      }
    );
  });
});

const getQueryField = () =>
  screen.getByTestId(selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsQueryInput);

const getRegExField = () => screen.getByLabelText(/Regex/);

const fieldAccessors: Record<string, () => HTMLElement> = {
  query: getQueryField,
  regex: getRegExField,
};
