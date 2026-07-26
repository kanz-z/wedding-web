import { test as setup } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';
import { ADMIN_CREDENTIALS } from './fixtures/test-data';

setup('authenticate admin', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.loginAndWaitForDashboard(
    ADMIN_CREDENTIALS.email,
    ADMIN_CREDENTIALS.password,
  );
  await page.context().storageState({ path: '.auth/admin-state.json' });
});
