/**
 * Generate a random string for file names
 * @returns {string} Random string
 */
export const getRandomString = (): string => {
  if (window.crypto && window.crypto.getRandomValues && navigator.userAgent.indexOf('Safari') === -1) {
    const a = window.crypto.getRandomValues(new Uint32Array(3));
    let token = '';
    for (let i = 0, l = a.length; i < l; i++) {
      token += a[i].toString(36);
    }
    return token;
  } else {
    return (Math.random() * new Date().getTime()).toString(36).replace(/\./g, '');
  }
};

/**
 * Convert bytes to human-readable size
 * @param {number} bytes - Size in bytes
 * @returns {string} Human-readable size (e.g., "1.5 MB")
 */
export const bytesToSize = (bytes: number): string => {
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 Bytes';
  const i = Math.floor(Math.log(bytes) / Math.log(1000));
  return (bytes / Math.pow(1000, i)).toFixed(1) + ' ' + sizes[i];
};

/**
 * Generate a file name with timestamp
 * @param {string} extension - File extension (e.g., "wav")
 * @returns {string} File name with timestamp
 */
export const getFileName = (extension: string): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const date = d.getDate();
  return `RecordRTC-${year}${month}${date}-${getRandomString()}.${extension}`;
};