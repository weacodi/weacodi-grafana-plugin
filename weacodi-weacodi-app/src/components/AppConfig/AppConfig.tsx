import React from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2, PluginConfigPageProps } from '@grafana/data';
import { Alert, useStyles2 } from '@grafana/ui';

export interface AppConfigProps extends PluginConfigPageProps {}

const AppConfig = () => {
  const s = useStyles2(getStyles);

  return (
    <div className={s.wrapper}>
      <Alert title="No configuration required" severity="info">
        The Weacodi Grafana plugin connects directly to the public Open-Meteo API. There are no configurable options in
        this release.
      </Alert>
    </div>
  );
};

export default AppConfig;

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css`
    margin-top: ${theme.spacing(3)};
  `,
});
