// Same SDK bundle and application key that index.html used to load eagerly.
const SDK_URL =
  'https://api.matterport.com/sdk/bootstrap/3.0.0-0-g0517b8d76c/sdk.es6.js?applicationKey=2m09afwdgxp3g0dgdr8zn193a';

let loading: Promise<void> | null = null;

/**
 * Loads the Matterport SDK on demand and exposes `window.connect`. Loading it lazily means the
 * app starts even if api.matterport.com is unreachable, and spaces shown as splats never fetch it.
 */
export function loadMatterportSdk(): Promise<void> {
  if (typeof window.connect === 'function') return Promise.resolve();
  if (!loading) {
    loading = import(/* @vite-ignore */ SDK_URL)
      .then(module => {
        window.connect = module.connect;
      })
      .catch(error => {
        loading = null;
        throw error;
      });
  }
  return loading;
}
