import React from 'react';
import { Route, Routes } from 'react-router-dom';
import { AppRootProps } from '@grafana/data';
import { ROUTES } from '../../constants';

const PageOne = React.lazy(async () => ({ default: (await import('../../pages/PageOne')).PageOne }));
const PageTwo = React.lazy(() => import('../../pages/PageTwo'));
const PageThree = React.lazy(() => import('../../pages/PageThree'));
const PageFour = React.lazy(() => import('../../pages/PageFour'));

function App(props: AppRootProps) {
  return (
    <Routes>
      <Route path={ROUTES.Two} element={<PageTwo />} />
      <Route path={`${ROUTES.Three}/:id?`} element={<PageThree />} />
      <Route path={ROUTES.Four} element={<PageFour />} />
      <Route path="*" element={<PageOne />} />
    </Routes>
  );
}

export default App;
