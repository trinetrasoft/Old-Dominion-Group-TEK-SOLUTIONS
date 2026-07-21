import { shell } from '../shell.js';
import { errorPage, bindErrorRetry } from '../ui/loading.js';

export function viewError(message) {
  shell(errorPage(message), { title: 'Error' });
  bindErrorRetry();
}
